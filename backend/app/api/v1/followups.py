from datetime import datetime, date, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import FollowUp, Patient, Doctor, Encounter, User
from app.schemas.schemas import FollowUpCreate, FollowUpResponse
from app.services.audit_service import log_audit_event, create_system_notification

router = APIRouter()

@router.post("", response_model=FollowUpResponse)
def create_followup(
    follow_in: FollowUpCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    doctor = db.query(Doctor).filter(Doctor.id == follow_in.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == follow_in.patient_id).first()
    
    if not doctor or not patient:
        raise HTTPException(status_code=404, detail="Doctor or Patient not found.")
        
    followup = FollowUp(
        patient_id=follow_in.patient_id,
        doctor_id=follow_in.doctor_id,
        encounter_id=follow_in.encounter_id,
        follow_up_date=follow_in.follow_up_date,
        reason=follow_in.reason or "Routine clinical review",
        instructions=follow_in.instructions or "Take medications as prescribed and report any unusual symptoms.",
        status="Scheduled",
        reminder_sent=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(followup)
    db.commit()
    db.refresh(followup)
    
    if patient.user_id:
        create_system_notification(
            db=db,
            user_id=patient.user_id,
            title="Follow-Up Scheduled",
            message=f"Dr. {doctor.user.full_name if doctor.user else 'Specialist'} has scheduled a follow-up review on {followup.follow_up_date.strftime('%B %d, %Y')}."
        )
        
    log_audit_event(
        db=db,
        action="SCHEDULE_FOLLOW_UP",
        resource_type="FollowUp",
        resource_id=str(followup.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"follow_up_date": str(followup.follow_up_date), "doctor_id": followup.doctor_id, "patient_id": followup.patient_id}
    )
    
    return {
        "id": followup.id,
        "patient_id": followup.patient_id,
        "doctor_id": followup.doctor_id,
        "encounter_id": followup.encounter_id,
        "doctor_name": doctor.user.full_name if doctor.user else "Doctor",
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "follow_up_date": followup.follow_up_date,
        "reason": followup.reason,
        "instructions": followup.instructions,
        "status": followup.status,
        "reminder_sent": followup.reminder_sent,
        "created_at": followup.created_at
    }

@router.get("/patient/{patient_id}", response_model=List[FollowUpResponse])
def get_patient_followups(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    followups = db.query(FollowUp).filter(FollowUp.patient_id == patient_id).order_by(FollowUp.follow_up_date.desc()).all()
    results = []
    for f in followups:
        doc = f.encounter.doctor if f.encounter else db.query(Doctor).filter(Doctor.id == f.doctor_id).first()
        pat = db.query(Patient).filter(Patient.id == f.patient_id).first()
        results.append({
            "id": f.id,
            "patient_id": f.patient_id,
            "doctor_id": f.doctor_id,
            "encounter_id": f.encounter_id,
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "follow_up_date": f.follow_up_date,
            "reason": f.reason,
            "instructions": f.instructions,
            "status": f.status,
            "reminder_sent": f.reminder_sent,
            "created_at": f.created_at
        })
    return results

@router.get("/doctor/{doctor_id}", response_model=List[FollowUpResponse])
def get_doctor_followups(
    doctor_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    followups = db.query(FollowUp).filter(FollowUp.doctor_id == doctor_id).order_by(FollowUp.follow_up_date.asc()).all()
    results = []
    for f in followups:
        doc = db.query(Doctor).filter(Doctor.id == f.doctor_id).first()
        pat = db.query(Patient).filter(Patient.id == f.patient_id).first()
        results.append({
            "id": f.id,
            "patient_id": f.patient_id,
            "doctor_id": f.doctor_id,
            "encounter_id": f.encounter_id,
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "follow_up_date": f.follow_up_date,
            "reason": f.reason,
            "instructions": f.instructions,
            "status": f.status,
            "reminder_sent": f.reminder_sent,
            "created_at": f.created_at
        })
    return results

@router.put("/{followup_id}/complete")
def complete_followup(
    followup_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    followup = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up record not found.")
    followup.status = "Completed"
    db.commit()
    return {"message": "Follow-up marked as completed."}
