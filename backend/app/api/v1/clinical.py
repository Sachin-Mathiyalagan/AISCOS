from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Encounter, Vitals, ClinicalNote, Patient, Doctor, User, QueueEntry, Appointment
from app.schemas.schemas import (
    EncounterCreate, EncounterUpdate, EncounterResponse, VitalsCreate, VitalsResponse,
    ClinicalNoteCreate, CDSDrugCheckRequest, CDSDrugCheckResponse, ClinicalRAGRequest
)
from app.ai.clinical_rag import clinical_cds
from app.services.billing_service import billing_service
from app.services.audit_service import log_audit_event, create_system_notification
from app.core.events import ws_manager

router = APIRouter()

@router.post("/encounters", response_model=EncounterResponse)
def create_encounter(
    enc_in: EncounterCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin", "super_admin"]))
) -> Any:
    doctor = db.query(Doctor).filter(Doctor.id == enc_in.doctor_id).first()
    patient = db.query(Patient).filter(Patient.id == enc_in.patient_id).first()
    
    if not doctor or not patient:
        raise HTTPException(status_code=404, detail="Doctor or Patient not found.")
        
    today_str = datetime.now().strftime("%Y%m%d")
    count = db.query(Encounter).count() + 1
    code = f"ENC-{today_str}-{count:04d}"
    
    encounter = Encounter(
        encounter_code=code,
        clinic_id=patient.clinic_id or 1,
        doctor_id=enc_in.doctor_id,
        patient_id=enc_in.patient_id,
        appointment_id=enc_in.appointment_id,
        queue_entry_id=enc_in.queue_entry_id,
        encounter_type=enc_in.encounter_type or "Outpatient",
        chief_complaint=enc_in.chief_complaint or "Outpatient consultation",
        status="In-Progress",
        start_time=datetime.now(timezone.utc)
    )
    db.add(encounter)
    db.commit()
    db.refresh(encounter)
    
    log_audit_event(
        db=db,
        action="CREATE_CLINICAL_ENCOUNTER",
        resource_type="Encounter",
        resource_id=code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"code": code, "patient_id": encounter.patient_id, "doctor_id": encounter.doctor_id}
    )
    
    return _format_encounter_response(encounter)

@router.get("/encounters/{encounter_id}", response_model=EncounterResponse)
def get_encounter(
    encounter_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found.")
    return _format_encounter_response(encounter)

@router.put("/encounters/{encounter_id}", response_model=EncounterResponse)
def update_encounter(
    encounter_id: int,
    update_in: EncounterUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found.")
        
    if update_in.chief_complaint is not None:
        encounter.chief_complaint = update_in.chief_complaint
    if update_in.examination_notes is not None:
        encounter.examination_notes = update_in.examination_notes
    if update_in.diagnosis_code is not None:
        encounter.diagnosis_code = update_in.diagnosis_code
    if update_in.diagnosis_title is not None:
        encounter.diagnosis_title = update_in.diagnosis_title
    if update_in.treatment_plan is not None:
        encounter.treatment_plan = update_in.treatment_plan
    if update_in.doctor_notes is not None:
        encounter.doctor_notes = update_in.doctor_notes
    if update_in.status is not None:
        encounter.status = update_in.status
        
    db.commit()
    db.refresh(encounter)
    
    log_audit_event(
        db=db,
        action="UPDATE_CLINICAL_ENCOUNTER",
        resource_type="Encounter",
        resource_id=encounter.encounter_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"code": encounter.encounter_code, "diagnosis": encounter.diagnosis_title}
    )
    
    return _format_encounter_response(encounter)

@router.post("/encounters/{encounter_id}/complete")
async def complete_encounter(
    encounter_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found.")
        
    now = datetime.now(timezone.utc)
    encounter.status = "Completed"
    encounter.end_time = now
    
    # 1. Update QueueEntry if linked
    if encounter.queue_entry:
        encounter.queue_entry.status = "Completed"
        encounter.queue_entry.consultation_end_time = now
    elif encounter.queue_entry_id:
        q = db.query(QueueEntry).filter(QueueEntry.id == encounter.queue_entry_id).first()
        if q:
            q.status = "Completed"
            q.consultation_end_time = now
            
    # 2. Update Appointment if linked
    if encounter.appointment:
        encounter.appointment.status = "Completed"
    elif encounter.appointment_id:
        a = db.query(Appointment).filter(Appointment.id == encounter.appointment_id).first()
        if a:
            a.status = "Completed"
            
    # 3. Automatically generate consolidated Invoice via billing service
    invoice = billing_service.generate_encounter_invoice(db, encounter.id)
    
    db.commit()
    
    # 4. Real-time WebSocket broadcasting
    await ws_manager.broadcast_to_channel(
        f"doctor:{encounter.doctor_id}:queue",
        {
            "event": "ENCOUNTER_COMPLETED",
            "encounter_code": encounter.encounter_code,
            "patient_id": encounter.patient_id,
            "invoice_number": invoice.invoice_number if invoice else None
        }
    )
    await ws_manager.broadcast_to_channel(
        f"clinic:1:queue",
        {
            "event": "ENCOUNTER_COMPLETED",
            "encounter_code": encounter.encounter_code
        }
    )
    
    # 5. In-App Notification to Patient
    if encounter.patient.user_id:
        create_system_notification(
            db=db,
            user_id=encounter.patient.user_id,
            title="Consultation Completed",
            message=f"Your consultation with Dr. {encounter.doctor.user.full_name if encounter.doctor and encounter.doctor.user else 'Specialist'} has concluded. Diagnosis: {encounter.diagnosis_title or 'Completed'}. Invoice {invoice.invoice_number if invoice else ''} generated."
        )
        
    log_audit_event(
        db=db,
        action="COMPLETE_CLINICAL_ENCOUNTER",
        resource_type="Encounter",
        resource_id=encounter.encounter_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"encounter_code": encounter.encounter_code, "invoice": invoice.invoice_number if invoice else None}
    )
    
    return {
        "message": f"Encounter {encounter.encounter_code} completed.",
        "encounter_id": encounter.id,
        "status": encounter.status,
        "invoice_number": invoice.invoice_number if invoice else None,
        "total_billed": invoice.total_amount if invoice else 0.0
    }

@router.post("/vitals", response_model=VitalsResponse)
def record_vitals(
    vitals_in: VitalsCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["nurse", "doctor", "clinic_admin"]))
) -> Any:
    # Calculate BMI
    bmi_val = None
    if vitals_in.weight_kg and vitals_in.height_cm and vitals_in.height_cm > 0:
        height_m = vitals_in.height_cm / 100.0
        bmi_val = round(vitals_in.weight_kg / (height_m * height_m), 1)
        
    vitals = Vitals(
        encounter_id=vitals_in.encounter_id,
        patient_id=vitals_in.patient_id,
        recorded_by_id=int(payload["sub"]),
        temperature_f=vitals_in.temperature_f,
        systolic_bp=vitals_in.systolic_bp,
        diastolic_bp=vitals_in.diastolic_bp,
        heart_rate_bpm=vitals_in.heart_rate_bpm,
        respiratory_rate=vitals_in.respiratory_rate,
        spo2_percent=vitals_in.spo2_percent,
        weight_kg=vitals_in.weight_kg,
        height_cm=vitals_in.height_cm,
        bmi=bmi_val,
        pain_score=vitals_in.pain_score or 0,
        triage_level=vitals_in.triage_level or 4,
        triage_notes=vitals_in.triage_notes
    )
    db.add(vitals)
    db.commit()
    db.refresh(vitals)
    
    # If patient has active queue entry, update its triage level
    active_queue = db.query(QueueEntry).filter(
        QueueEntry.patient_id == vitals_in.patient_id,
        QueueEntry.status.in_(["Waiting", "Called"])
    ).first()
    if active_queue and vitals_in.triage_level:
        active_queue.triage_level = vitals_in.triage_level
        db.commit()
        
    log_audit_event(
        db=db,
        action="RECORD_VITALS_TRIAGE",
        resource_type="Vitals",
        resource_id=str(vitals.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"patient_id": vitals_in.patient_id, "bmi": bmi_val, "triage": vitals.triage_level}
    )
    return vitals

@router.post("/notes")
def save_clinical_notes(
    notes_in: ClinicalNoteCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    encounter = db.query(Encounter).filter(Encounter.id == notes_in.encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found.")
        
    note = db.query(ClinicalNote).filter(ClinicalNote.encounter_id == notes_in.encounter_id).first()
    if not note:
        note = ClinicalNote(
            encounter_id=notes_in.encounter_id,
            doctor_id=encounter.doctor_id,
            subjective=notes_in.subjective,
            objective=notes_in.objective,
            assessment=notes_in.assessment,
            plan=notes_in.plan,
            ai_speech_transcript=notes_in.ai_speech_transcript,
            ai_suggested_draft=notes_in.ai_suggested_draft,
            is_signed=notes_in.is_signed or False,
            signed_at=datetime.now(timezone.utc) if notes_in.is_signed else None
        )
        db.add(note)
    else:
        note.subjective = notes_in.subjective
        note.objective = notes_in.objective
        note.assessment = notes_in.assessment
        note.plan = notes_in.plan
        if notes_in.ai_speech_transcript:
            note.ai_speech_transcript = notes_in.ai_speech_transcript
        if notes_in.is_signed:
            note.is_signed = True
            note.signed_at = datetime.now(timezone.utc)
            
    # Update encounter assessment and plan
    if notes_in.assessment:
        encounter.diagnosis_title = notes_in.assessment
    if notes_in.plan:
        encounter.treatment_plan = notes_in.plan
        
    db.commit()
    db.refresh(note)
    
    log_audit_event(
        db=db,
        action="UPDATE_CLINICAL_NOTES",
        resource_type="ClinicalNote",
        resource_id=str(note.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"encounter_id": encounter.id, "is_signed": note.is_signed}
    )
    return {
        "id": note.id,
        "encounter_id": note.encounter_id,
        "doctor_id": note.doctor_id,
        "subjective": note.subjective,
        "objective": note.objective,
        "assessment": note.assessment,
        "plan": note.plan,
        "ai_speech_transcript": note.ai_speech_transcript,
        "ai_suggested_draft": note.ai_suggested_draft,
        "is_signed": note.is_signed,
        "signed_at": note.signed_at.isoformat() if getattr(note, "signed_at", None) else None,
        "created_at": note.created_at.isoformat() if getattr(note, "created_at", None) else None
    }

@router.post("/cds/check-interactions", response_model=CDSDrugCheckResponse)
def check_clinical_drug_interactions(
    request: CDSDrugCheckRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "nurse", "pharmacist", "clinic_admin"]))
) -> Any:
    patient = db.query(Patient).filter(Patient.id == request.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    result = clinical_cds.check_drug_interactions_and_allergies(
        new_medications=request.new_medicines,
        patient_allergies=patient.allergies or "None",
        current_medications=patient.current_medications or "None"
    )
    return result

@router.post("/cds/guidelines-rag")
def query_guidelines_rag(
    rag_req: ClinicalRAGRequest,
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    results = clinical_cds.query_guidelines_rag(rag_req.query)
    return {
        "query": rag_req.query,
        "evidence_sources": results,
        "disclaimer": "AISCOS Clinical Decision Support: Synthesized from peer-reviewed clinical guidelines (AHA, ADA, NICE, GINA, ESC). Requires physician review."
    }

@router.post("/speech-to-soap")
def transcribe_speech_to_soap_draft(
    dictation: dict,
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    text = dictation.get("transcript", "")
    if not text:
        raise HTTPException(status_code=400, detail="Transcript text is required.")
        
    draft = clinical_cds.transcribe_and_draft_soap(text)
    return draft

def _format_encounter_response(encounter: Encounter) -> dict:
    doc_name = encounter.doctor.user.full_name if encounter.doctor and encounter.doctor.user else "Doctor"
    pat_name = f"{encounter.patient.first_name} {encounter.patient.last_name}" if encounter.patient else "Patient"
    pat_mrn = encounter.patient.mrn if encounter.patient else "N/A"
    
    vitals_dict = None
    if encounter.vitals:
        v = encounter.vitals
        vitals_dict = {
            "id": v.id,
            "temperature_f": v.temperature_f,
            "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp,
            "heart_rate_bpm": v.heart_rate_bpm,
            "respiratory_rate": v.respiratory_rate,
            "spo2_percent": v.spo2_percent,
            "weight_kg": v.weight_kg,
            "height_cm": v.height_cm,
            "bmi": v.bmi,
            "pain_score": v.pain_score,
            "triage_level": v.triage_level,
            "recorded_at": v.recorded_at
        }
        
    notes_dict = None
    if encounter.clinical_note:
        n = encounter.clinical_note
        notes_dict = {
            "id": n.id,
            "subjective": n.subjective,
            "objective": n.objective,
            "assessment": n.assessment,
            "plan": n.plan,
            "is_signed": n.is_signed,
            "signed_at": n.signed_at
        }
        
    rx_dict = None
    if encounter.prescription:
        rx = encounter.prescription
        rx_dict = {
            "id": rx.id,
            "prescription_code": rx.prescription_code,
            "status": rx.status,
            "items_count": len(rx.items)
        }
        
    lab_list = []
    for o in encounter.lab_orders:
        lab_list.append({
            "id": o.id,
            "order_number": o.order_number,
            "test_name": o.test.name if o.test else "Diagnostic Test",
            "status": o.status
        })
        
    return {
        "id": encounter.id,
        "encounter_code": encounter.encounter_code,
        "clinic_id": encounter.clinic_id,
        "doctor_id": encounter.doctor_id,
        "patient_id": encounter.patient_id,
        "appointment_id": encounter.appointment_id,
        "queue_entry_id": encounter.queue_entry_id,
        "doctor_name": doc_name,
        "patient_name": pat_name,
        "patient_mrn": pat_mrn,
        "encounter_type": encounter.encounter_type,
        "chief_complaint": encounter.chief_complaint,
        "examination_notes": encounter.examination_notes,
        "diagnosis_code": encounter.diagnosis_code,
        "diagnosis_title": encounter.diagnosis_title,
        "treatment_plan": encounter.treatment_plan,
        "doctor_notes": encounter.doctor_notes,
        "status": encounter.status,
        "start_time": encounter.start_time,
        "end_time": encounter.end_time,
        "vitals": vitals_dict,
        "clinical_note": notes_dict,
        "prescription": rx_dict,
        "lab_orders": lab_list
    }
