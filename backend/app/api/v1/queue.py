from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.core.events import ws_manager
from app.models.models import QueueEntry, Doctor, Patient, User, Encounter
from app.schemas.schemas import (
    CheckInRequest, QueueEntryResponse, QueueTransferRequest,
    EmergencyQueueRequest, QueueSummaryResponse
)
from app.services.queue_engine import queue_engine
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("/summary", response_model=QueueSummaryResponse)
def get_queue_metrics_summary(db: Session = Depends(get_db)) -> Any:
    return queue_engine.get_queue_summary(db)

@router.post("/check-in", response_model=QueueEntryResponse)
async def check_in_patient(
    checkin_data: CheckInRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    try:
        entry = queue_engine.check_in_patient(
            db=db,
            patient_id=checkin_data.patient_id,
            doctor_id=checkin_data.doctor_id,
            appointment_id=checkin_data.appointment_id,
            is_emergency=checkin_data.is_emergency or False,
            triage_level=checkin_data.triage_level or 4,
            chief_complaint=checkin_data.chief_complaint
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    doc = db.query(Doctor).filter(Doctor.id == entry.doctor_id).first()
    pat = db.query(Patient).filter(Patient.id == entry.patient_id).first()
    
    # Broadcast real-time WebSocket events to clinic, doctor, and patient channels
    await ws_manager.broadcast_to_channel(
        f"clinic:1:queue",
        {
            "event": "QUEUE_UPDATED",
            "token_number": entry.token_number,
            "patient_name": f"{pat.first_name} {pat.last_name}",
            "doctor_id": entry.doctor_id,
            "status": entry.status,
            "estimated_wait_minutes": entry.estimated_wait_minutes
        }
    )
    await ws_manager.broadcast_to_channel(
        f"doctor:{entry.doctor_id}:queue",
        {
            "event": "QUEUE_UPDATED",
            "token_number": entry.token_number,
            "patient_name": f"{pat.first_name} {pat.last_name}",
            "status": entry.status,
            "estimated_wait_minutes": entry.estimated_wait_minutes
        }
    )
    if pat.user_id:
        await ws_manager.broadcast_to_channel(
            f"patient:{pat.id}",
            {
                "event": "TOKEN_GENERATED",
                "token_number": entry.token_number,
                "status": entry.status,
                "estimated_wait_minutes": entry.estimated_wait_minutes
            }
        )
    
    log_audit_event(
        db=db,
        action="SMART_CHECK_IN",
        resource_type="QueueEntry",
        resource_id=entry.token_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"token": entry.token_number, "priority": entry.priority_score, "doctor_id": entry.doctor_id}
    )
    
    return {
        "id": entry.id,
        "token_number": entry.token_number,
        "doctor_id": entry.doctor_id,
        "patient_id": entry.patient_id,
        "appointment_id": entry.appointment_id,
        "patient_name": f"{pat.first_name} {pat.last_name}",
        "patient_mrn": pat.mrn,
        "patient_gender": pat.gender,
        "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
        "doctor_specialty": doc.specialty if doc else "General Medicine",
        "room_number": doc.room_number if doc else "Room 101",
        "status": entry.status,
        "priority_score": entry.priority_score,
        "is_emergency": entry.is_emergency,
        "triage_level": entry.triage_level,
        "queue_position": entry.queue_position,
        "estimated_wait_minutes": entry.estimated_wait_minutes,
        "confidence_interval_min": entry.confidence_interval_min,
        "confidence_interval_max": entry.confidence_interval_max,
        "check_in_time": entry.check_in_time,
        "called_time": entry.called_time,
        "consultation_start_time": entry.consultation_start_time,
        "consultation_end_time": entry.consultation_end_time
    }

@router.get("/doctor/{doctor_id}", response_model=List[QueueEntryResponse])
def get_doctor_active_queue(
    doctor_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    # Refresh priority aging scores first
    queue_engine.refresh_queue_order(db, doctor_id)
    
    entries = db.query(QueueEntry).filter(
        QueueEntry.doctor_id == doctor_id,
        QueueEntry.status.in_(["Waiting", "Called", "In-Consultation"])
    ).order_by(
        # In-Consultation and Called on top, then Waiting by position
        QueueEntry.status.desc(),
        QueueEntry.queue_position.asc()
    ).all()
    
    result = []
    for entry in entries:
        doc = entry.doctor
        pat = entry.patient
        result.append({
            "id": entry.id,
            "token_number": entry.token_number,
            "doctor_id": entry.doctor_id,
            "patient_id": entry.patient_id,
            "appointment_id": entry.appointment_id,
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "patient_mrn": pat.mrn if pat else "N/A",
            "patient_gender": pat.gender if pat else "N/A",
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "doctor_specialty": doc.specialty if doc else "General Medicine",
            "room_number": doc.room_number if doc else "Room 101",
            "status": entry.status,
            "priority_score": entry.priority_score,
            "is_emergency": entry.is_emergency,
            "triage_level": entry.triage_level,
            "queue_position": entry.queue_position,
            "estimated_wait_minutes": entry.estimated_wait_minutes,
            "confidence_interval_min": entry.confidence_interval_min,
            "confidence_interval_max": entry.confidence_interval_max,
            "check_in_time": entry.check_in_time,
            "called_time": entry.called_time,
            "consultation_start_time": entry.consultation_start_time,
            "consultation_end_time": entry.consultation_end_time
        })
    return result

@router.get("/patient/{patient_id}")
def get_patient_active_queue_status(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    """Returns the patient's current active token, queue position, patients ahead, and AI predicted wait."""
    entry = db.query(QueueEntry).filter(
        QueueEntry.patient_id == patient_id,
        QueueEntry.status.in_(["Waiting", "Called", "In-Consultation"])
    ).order_by(QueueEntry.check_in_time.desc()).first()
    
    if not entry:
        return {"has_active_token": False, "active_entry": None}
        
    doc = entry.doctor
    pat = entry.patient
    
    patients_ahead = 0
    if entry.status == "Waiting":
        patients_ahead = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == entry.doctor_id,
            QueueEntry.status == "Waiting",
            QueueEntry.queue_position < entry.queue_position
        ).count()
        
    return {
        "has_active_token": True,
        "active_entry": {
            "id": entry.id,
            "token_number": entry.token_number,
            "doctor_id": entry.doctor_id,
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "doctor_specialty": doc.specialty if doc else "General",
            "room_number": doc.room_number if doc else "Room 101",
            "status": entry.status,
            "queue_position": entry.queue_position,
            "patients_ahead": patients_ahead,
            "estimated_wait_minutes": entry.estimated_wait_minutes,
            "confidence_interval_min": entry.confidence_interval_min,
            "confidence_interval_max": entry.confidence_interval_max,
            "check_in_time": entry.check_in_time.strftime("%Y-%m-%d %H:%M"),
            "called_time": entry.called_time.strftime("%Y-%m-%d %H:%M") if entry.called_time else None
        }
    }

@router.post("/{queue_id}/call")
async def doctor_call_patient(
    queue_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "nurse", "clinic_admin"]))
) -> Any:
    entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")
        
    updated_entry = queue_engine.call_patient(db=db, queue_id=queue_id, doctor_id=entry.doctor_id)
    
    await ws_manager.broadcast_to_channel(
        f"clinic:1:queue",
        {
            "event": "PATIENT_CALLED",
            "token_number": updated_entry.token_number,
            "doctor_id": updated_entry.doctor_id,
            "room": updated_entry.doctor.room_number if updated_entry.doctor else "Room 101"
        }
    )
    await ws_manager.broadcast_to_channel(
        f"doctor:{entry.doctor_id}:queue",
        {
            "event": "PATIENT_CALLED",
            "token_number": updated_entry.token_number,
            "room": updated_entry.doctor.room_number if updated_entry.doctor else "Room 101"
        }
    )
    
    log_audit_event(
        db=db,
        action="DOCTOR_CALL_PATIENT",
        resource_type="QueueEntry",
        resource_id=updated_entry.token_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"token": updated_entry.token_number, "status": "Called"}
    )
    return {
        "message": f"Patient with token {updated_entry.token_number} called to {updated_entry.doctor.room_number if updated_entry.doctor else 'room'}.",
        "entry_id": updated_entry.id,
        "token_number": updated_entry.token_number,
        "status": updated_entry.status
    }

@router.post("/{queue_id}/start")
async def start_consultation(
    queue_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")
        
    updated_entry, encounter = queue_engine.start_consultation(db=db, queue_id=queue_id, doctor_id=entry.doctor_id)
    
    await ws_manager.broadcast_to_channel(
        f"doctor:{entry.doctor_id}:queue",
        {
            "event": "CONSULTATION_STARTED",
            "token_number": updated_entry.token_number,
            "encounter_id": encounter.id,
            "encounter_code": encounter.encounter_code
        }
    )
    
    log_audit_event(
        db=db,
        action="START_CONSULTATION",
        resource_type="Encounter",
        resource_id=encounter.encounter_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"encounter_code": encounter.encounter_code, "token": updated_entry.token_number}
    )
    return {
        "message": f"Consultation started for token {updated_entry.token_number}.",
        "entry_id": updated_entry.id,
        "token_number": updated_entry.token_number,
        "encounter_id": encounter.id,
        "encounter_code": encounter.encounter_code,
        "status": updated_entry.status
    }

@router.post("/{queue_id}/complete")
async def complete_consultation(
    queue_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found.")
        
    updated_entry = queue_engine.complete_consultation(db=db, queue_id=queue_id)
    
    await ws_manager.broadcast_to_channel(
        f"clinic:1:queue",
        {
            "event": "CONSULTATION_COMPLETED",
            "token_number": updated_entry.token_number,
            "doctor_id": updated_entry.doctor_id
        }
    )
    await ws_manager.broadcast_to_channel(
        f"doctor:{entry.doctor_id}:queue",
        {
            "event": "CONSULTATION_COMPLETED",
            "token_number": updated_entry.token_number
        }
    )
    
    log_audit_event(
        db=db,
        action="COMPLETE_CONSULTATION",
        resource_type="QueueEntry",
        resource_id=updated_entry.token_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"]
    )
    return {"message": f"Consultation for token {updated_entry.token_number} completed successfully."}

@router.post("/{queue_id}/transfer", response_model=QueueEntryResponse)
async def transfer_queue_entry(
    queue_id: int,
    req: QueueTransferRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "receptionist", "nurse", "clinic_admin"]))
) -> Any:
    try:
        new_entry = queue_engine.transfer_queue_entry(
            db=db,
            queue_id=queue_id,
            new_doctor_id=req.new_doctor_id,
            reason=req.reason or "Patient transferred",
            triage_level=req.triage_level
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    doc = new_entry.doctor
    pat = new_entry.patient
    
    await ws_manager.broadcast_to_channel(
        f"clinic:1:queue",
        {
            "event": "QUEUE_TRANSFERRED",
            "token_number": new_entry.token_number,
            "destination_doctor": doc.user.full_name if doc and doc.user else str(new_entry.doctor_id)
        }
    )
    
    log_audit_event(
        db=db,
        action="TRANSFER_QUEUE_ENTRY",
        resource_type="QueueEntry",
        resource_id=new_entry.token_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"from_queue_id": queue_id, "new_doctor_id": req.new_doctor_id, "reason": req.reason}
    )
    
    return {
        "id": new_entry.id,
        "token_number": new_entry.token_number,
        "doctor_id": new_entry.doctor_id,
        "patient_id": new_entry.patient_id,
        "appointment_id": new_entry.appointment_id,
        "patient_name": f"{pat.first_name} {pat.last_name}",
        "patient_mrn": pat.mrn,
        "patient_gender": pat.gender,
        "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
        "doctor_specialty": doc.specialty if doc else "General",
        "room_number": doc.room_number if doc else "Room 101",
        "status": new_entry.status,
        "priority_score": new_entry.priority_score,
        "is_emergency": new_entry.is_emergency,
        "triage_level": new_entry.triage_level,
        "queue_position": new_entry.queue_position,
        "estimated_wait_minutes": new_entry.estimated_wait_minutes,
        "confidence_interval_min": new_entry.confidence_interval_min,
        "confidence_interval_max": new_entry.confidence_interval_max,
        "check_in_time": new_entry.check_in_time,
        "called_time": new_entry.called_time,
        "consultation_start_time": new_entry.consultation_start_time,
        "consultation_end_time": new_entry.consultation_end_time
    }

@router.post("/emergency-insert", response_model=QueueEntryResponse)
async def insert_emergency_queue(
    req: EmergencyQueueRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "nurse", "clinic_admin"]))
) -> Any:
    try:
        entry = queue_engine.check_in_patient(
            db=db,
            patient_id=req.patient_id,
            doctor_id=req.doctor_id,
            is_emergency=True,
            triage_level=1,
            chief_complaint=f"EMERGENCY: {req.reason}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    doc = entry.doctor
    pat = entry.patient
    
    await ws_manager.broadcast_to_channel(
        f"doctor:{entry.doctor_id}:queue",
        {
            "event": "EMERGENCY_INSERTION",
            "token_number": entry.token_number,
            "patient_name": f"{pat.first_name} {pat.last_name}"
        }
    )
    
    log_audit_event(
        db=db,
        action="EMERGENCY_QUEUE_INSERTION",
        resource_type="QueueEntry",
        resource_id=entry.token_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"reason": req.reason, "doctor_id": req.doctor_id, "token": entry.token_number}
    )
    
    return {
        "id": entry.id,
        "token_number": entry.token_number,
        "doctor_id": entry.doctor_id,
        "patient_id": entry.patient_id,
        "appointment_id": entry.appointment_id,
        "patient_name": f"{pat.first_name} {pat.last_name}",
        "patient_mrn": pat.mrn,
        "patient_gender": pat.gender,
        "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
        "doctor_specialty": doc.specialty if doc else "General",
        "room_number": doc.room_number if doc else "Room 101",
        "status": entry.status,
        "priority_score": entry.priority_score,
        "is_emergency": entry.is_emergency,
        "triage_level": entry.triage_level,
        "queue_position": entry.queue_position,
        "estimated_wait_minutes": entry.estimated_wait_minutes,
        "confidence_interval_min": entry.confidence_interval_min,
        "confidence_interval_max": entry.confidence_interval_max,
        "check_in_time": entry.check_in_time,
        "called_time": entry.called_time,
        "consultation_start_time": entry.consultation_start_time,
        "consultation_end_time": entry.consultation_end_time
    }

@router.get("/public-display")
def get_public_queue_board(db: Session = Depends(get_db)) -> Any:
    doctors = db.query(Doctor).filter(Doctor.is_available == True).all()
    board = []
    
    for doc in doctors:
        # Refresh doctor's queue order
        queue_engine.refresh_queue_order(db, doc.id)
        
        current_patient = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doc.id,
            QueueEntry.status.in_(["Called", "In-Consultation"])
        ).order_by(QueueEntry.called_time.desc()).first()
        
        waiting_list = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doc.id,
            QueueEntry.status == "Waiting"
        ).order_by(QueueEntry.queue_position.asc()).limit(5).all()
        
        board.append({
            "doctor_id": doc.id,
            "doctor_name": doc.user.full_name if doc.user else f"Dr. {doc.id}",
            "specialty": doc.specialty,
            "room_number": doc.room_number or "Room 101",
            "current_token": current_patient.token_number if current_patient else "None",
            "current_patient_status": current_patient.status if current_patient else "Available",
            "next_tokens": [
                {
                    "token": w.token_number,
                    "eta_mins": w.estimated_wait_minutes,
                    "triage_level": w.triage_level,
                    "is_emergency": w.is_emergency
                }
                for w in waiting_list
            ]
        })
    return board
