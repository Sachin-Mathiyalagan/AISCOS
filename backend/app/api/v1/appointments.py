from datetime import datetime, date, time, timedelta, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Appointment, Doctor, Patient, User, DoctorSchedule, QueueEntry
from app.schemas.schemas import (
    AppointmentCreate, AppointmentResponse, AppointmentRescheduleRequest,
    AppointmentCancelRequest, AvailableSlotsResponse
)
from app.services.audit_service import log_audit_event, create_system_notification

router = APIRouter()

@router.get("", response_model=List[AppointmentResponse])
def list_appointments(
    doctor_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    appointment_date: Optional[date] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    query = db.query(Appointment)
    if doctor_id:
        query = query.filter(Appointment.doctor_id == doctor_id)
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if appointment_date:
        query = query.filter(Appointment.appointment_date == appointment_date)
    if status_filter:
        query = query.filter(Appointment.status == status_filter)
        
    appts = query.order_by(Appointment.appointment_date.desc(), Appointment.slot_time.asc()).limit(limit).all()
    
    result = []
    for a in appts:
        doc_name = a.doctor.user.full_name if a.doctor and a.doctor.user else f"Dr. {a.doctor_id}"
        doc_spec = a.doctor.specialty if a.doctor else "General Medicine"
        pat_name = f"{a.patient.first_name} {a.patient.last_name}" if a.patient else "Patient"
        pat_mrn = a.patient.mrn if a.patient else "N/A"
        result.append({
            "id": a.id,
            "appointment_code": a.appointment_code,
            "doctor_id": a.doctor_id,
            "patient_id": a.patient_id,
            "doctor_name": doc_name,
            "patient_name": pat_name,
            "patient_mrn": pat_mrn,
            "doctor_specialty": doc_spec,
            "appointment_date": a.appointment_date,
            "slot_time": a.slot_time,
            "appointment_type": a.appointment_type,
            "status": a.status,
            "chief_complaint": a.chief_complaint,
            "is_walk_in": a.is_walk_in,
            "created_at": a.created_at
        })
    return result

@router.get("/slots", response_model=AvailableSlotsResponse)
def get_available_slots(
    doctor_id: int = Query(..., description="Doctor ID"),
    appointment_date: date = Query(..., description="Date for appointment YYYY-MM-DD"),
    db: Session = Depends(get_db)
) -> Any:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
        
    day_of_week = appointment_date.weekday() # 0 = Mon, 6 = Sun
    
    schedule = db.query(DoctorSchedule).filter(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.day_of_week == day_of_week,
        DoctorSchedule.is_active == True
    ).first()
    
    start_str = schedule.start_time if schedule else "09:00"
    end_str = schedule.end_time if schedule else "17:00"
    duration = schedule.slot_duration_mins if schedule else (doctor.avg_consultation_time or 15)
    
    # Generate slots array
    slots = []
    start_dt = datetime.strptime(start_str, "%H:%M")
    end_dt = datetime.strptime(end_str, "%H:%M")
    curr = start_dt
    while curr < end_dt:
        slots.append(curr.strftime("%H:%M"))
        curr += timedelta(minutes=duration)
        
    # Query booked appointments
    booked_appts = db.query(Appointment.slot_time).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.status.in_(["Scheduled", "Checked-In", "In-Consultation"])
    ).all()
    booked_set = {b[0] for b in booked_appts}
    
    available = [s for s in slots if s not in booked_set]
    
    return {
        "doctor_id": doctor.id,
        "doctor_name": doctor.user.full_name if doctor.user else f"Dr. {doctor.id}",
        "specialty": doctor.specialty,
        "date": appointment_date,
        "day_of_week": day_of_week,
        "slot_duration_mins": duration,
        "available_slots": available,
        "booked_slots": list(booked_set)
    }

@router.get("/doctors")
def list_available_doctors(db: Session = Depends(get_db)) -> Any:
    doctors = db.query(Doctor).filter(Doctor.is_available == True).all()
    res = []
    for d in doctors:
        res.append({
            "id": d.id,
            "user_id": d.user_id,
            "full_name": d.user.full_name if d.user else f"Dr. {d.id}",
            "email": d.user.email if d.user else "",
            "specialty": d.specialty,
            "qualification": d.qualification,
            "room_number": d.room_number,
            "consultation_fee": d.consultation_fee,
            "avg_consultation_time": d.avg_consultation_time,
            "is_available": d.is_available,
            "department_name": d.department.name if d.department else "General Medicine"
        })
    return res

@router.post("", response_model=AppointmentResponse)
def book_appointment(
    appt_in: AppointmentCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    doctor = db.query(Doctor).filter(Doctor.id == appt_in.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == appt_in.patient_id).first()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found.")
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    # 1. Collision Check
    existing = db.query(Appointment).filter(
        Appointment.doctor_id == appt_in.doctor_id,
        Appointment.appointment_date == appt_in.appointment_date,
        Appointment.slot_time == appt_in.slot_time,
        Appointment.status.in_(["Scheduled", "Checked-In", "In-Consultation"])
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Selected slot {appt_in.slot_time} on {appt_in.appointment_date} is already booked for Dr. {doctor.user.full_name if doctor.user else doctor.id}. Please choose another slot."
        )
        
    today_str = appt_in.appointment_date.strftime("%Y%m%d")
    count = db.query(Appointment).count() + 1
    code = f"APT-{today_str}-{count:04d}"
    
    appt = Appointment(
        appointment_code=code,
        clinic_id=patient.clinic_id or 1,
        doctor_id=appt_in.doctor_id,
        patient_id=appt_in.patient_id,
        appointment_date=appt_in.appointment_date,
        slot_time=appt_in.slot_time,
        appointment_type=appt_in.appointment_type or "Routine",
        status="Scheduled",
        chief_complaint=appt_in.chief_complaint or "Scheduled outpatient consultation",
        is_walk_in=appt_in.is_walk_in or False
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    
    # Notifications
    if patient.user_id:
        create_system_notification(
            db=db,
            user_id=patient.user_id,
            title="Appointment Confirmed",
            message=f"Your appointment with {doctor.user.full_name if doctor.user else 'Specialist'} is confirmed for {appt.appointment_date} at {appt.slot_time} ({appt.appointment_code})."
        )
    if doctor.user_id:
        create_system_notification(
            db=db,
            user_id=doctor.user_id,
            title="New Patient Booking",
            message=f"New appointment booked: {patient.first_name} {patient.last_name} for {appt.appointment_date} at {appt.slot_time}."
        )
        
    log_audit_event(
        db=db,
        action="BOOK_APPOINTMENT",
        resource_type="Appointment",
        resource_id=code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"code": code, "doctor_id": appt.doctor_id, "date": str(appt.appointment_date), "slot": appt.slot_time}
    )
    
    return {
        "id": appt.id,
        "appointment_code": appt.appointment_code,
        "doctor_id": appt.doctor_id,
        "patient_id": appt.patient_id,
        "doctor_name": doctor.user.full_name if doctor.user else "Doctor",
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "patient_mrn": patient.mrn,
        "doctor_specialty": doctor.specialty,
        "appointment_date": appt.appointment_date,
        "slot_time": appt.slot_time,
        "appointment_type": appt.appointment_type,
        "status": appt.status,
        "chief_complaint": appt.chief_complaint,
        "is_walk_in": appt.is_walk_in,
        "created_at": appt.created_at
    }

@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return {
        "id": appt.id,
        "appointment_code": appt.appointment_code,
        "doctor_id": appt.doctor_id,
        "patient_id": appt.patient_id,
        "doctor_name": appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor",
        "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}" if appt.patient else "Patient",
        "patient_mrn": appt.patient.mrn if appt.patient else "N/A",
        "doctor_specialty": appt.doctor.specialty if appt.doctor else "General",
        "appointment_date": appt.appointment_date,
        "slot_time": appt.slot_time,
        "appointment_type": appt.appointment_type,
        "status": appt.status,
        "chief_complaint": appt.chief_complaint,
        "is_walk_in": appt.is_walk_in,
        "created_at": appt.created_at
    }

@router.put("/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: int,
    req: AppointmentRescheduleRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if appt.status in ["Completed", "Cancelled"]:
        raise HTTPException(status_code=400, detail=f"Cannot reschedule appointment in status '{appt.status}'.")
        
    # Check collision for new slot
    existing = db.query(Appointment).filter(
        Appointment.doctor_id == appt.doctor_id,
        Appointment.appointment_date == req.appointment_date,
        Appointment.slot_time == req.slot_time,
        Appointment.status.in_(["Scheduled", "Checked-In", "In-Consultation"]),
        Appointment.id != appt.id
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Slot {req.slot_time} on {req.appointment_date} is already booked. Please select another slot."
        )
        
    old_date = appt.appointment_date
    old_slot = appt.slot_time
    
    appt.appointment_date = req.appointment_date
    appt.slot_time = req.slot_time
    appt.status = "Scheduled"
    db.commit()
    db.refresh(appt)
    
    if appt.patient.user_id:
        create_system_notification(
            db=db,
            user_id=appt.patient.user_id,
            title="Appointment Rescheduled",
            message=f"Your appointment {appt.appointment_code} has been rescheduled to {appt.appointment_date} at {appt.slot_time}."
        )
        
    log_audit_event(
        db=db,
        action="RESCHEDULE_APPOINTMENT",
        resource_type="Appointment",
        resource_id=appt.appointment_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"old_date": str(old_date), "old_slot": old_slot, "new_date": str(req.appointment_date), "new_slot": req.slot_time, "reason": req.reason}
    )
    
    return {
        "id": appt.id,
        "appointment_code": appt.appointment_code,
        "doctor_id": appt.doctor_id,
        "patient_id": appt.patient_id,
        "doctor_name": appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor",
        "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}" if appt.patient else "Patient",
        "patient_mrn": appt.patient.mrn if appt.patient else "N/A",
        "doctor_specialty": appt.doctor.specialty if appt.doctor else "General",
        "appointment_date": appt.appointment_date,
        "slot_time": appt.slot_time,
        "appointment_type": appt.appointment_type,
        "status": appt.status,
        "chief_complaint": appt.chief_complaint,
        "is_walk_in": appt.is_walk_in,
        "created_at": appt.created_at
    }

@router.put("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: int,
    req: AppointmentCancelRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    if appt.status == "Completed":
        raise HTTPException(status_code=400, detail="Cannot cancel an already completed appointment.")
        
    appt.status = "Cancelled"
    
    # If active queue entry exists, mark cancelled
    queue_entry = db.query(QueueEntry).filter(
        QueueEntry.appointment_id == appt.id,
        QueueEntry.status.in_(["Waiting", "Called"])
    ).first()
    if queue_entry:
        queue_entry.status = "Cancelled"
        
    db.commit()
    db.refresh(appt)
    
    if appt.patient.user_id:
        create_system_notification(
            db=db,
            user_id=appt.patient.user_id,
            title="Appointment Cancelled",
            message=f"Your appointment {appt.appointment_code} on {appt.appointment_date} has been cancelled. Reason: {req.reason}"
        )
        
    log_audit_event(
        db=db,
        action="CANCEL_APPOINTMENT",
        resource_type="Appointment",
        resource_id=appt.appointment_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"code": appt.appointment_code, "reason": req.reason}
    )
    
    return {
        "id": appt.id,
        "appointment_code": appt.appointment_code,
        "doctor_id": appt.doctor_id,
        "patient_id": appt.patient_id,
        "doctor_name": appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor",
        "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}" if appt.patient else "Patient",
        "patient_mrn": appt.patient.mrn if appt.patient else "N/A",
        "doctor_specialty": appt.doctor.specialty if appt.doctor else "General",
        "appointment_date": appt.appointment_date,
        "slot_time": appt.slot_time,
        "appointment_type": appt.appointment_type,
        "status": appt.status,
        "chief_complaint": appt.chief_complaint,
        "is_walk_in": appt.is_walk_in,
        "created_at": appt.created_at
    }
