from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Notification, AuditLog, Patient, Encounter
from app.services.fhir_service import fhir_service

router = APIRouter()

# Notifications
@router.get("/notifications")
def get_user_notifications(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    user_id = int(payload["sub"])
    notifs = db.query(Notification).filter(Notification.user_id == user_id).order_by(Notification.sent_at.desc()).limit(20).all()
    return notifs

@router.post("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    user_id = int(payload["sub"])
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}

# Audit Logs
@router.get("/audit/logs")
def get_system_audit_logs(
    limit: int = Query(100, le=300),
    action: str = None,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["super_admin", "clinic_admin"]))
) -> Any:
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "user_email": l.user_email,
            "user_role": l.user_role,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "ip_address": l.ip_address,
            "details": l.details,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for l in logs
    ]

# HL7 FHIR Interoperability API
@router.get("/fhir/Patient/{patient_id}")
def get_fhir_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return fhir_service.to_fhir_patient(patient)

@router.get("/fhir/Encounter/{encounter_id}")
def get_fhir_encounter(
    encounter_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found.")
    return fhir_service.to_fhir_encounter(encounter)
