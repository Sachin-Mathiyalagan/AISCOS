from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Patient, Encounter, Vitals, Prescription, LabOrder, Invoice, Appointment
from app.schemas.schemas import PatientCreate, PatientUpdate, PatientResponse
from app.services.audit_service import log_audit_event

router = APIRouter()

@router.get("", response_model=List[PatientResponse])
def list_patients(
    search: Optional[str] = Query(None, description="Search by name, MRN, or phone"),
    limit: int = Query(50, le=150),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    query = db.query(Patient)
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Patient.first_name.ilike(s),
                Patient.last_name.ilike(s),
                Patient.mrn.ilike(s),
                Patient.phone.ilike(s)
            )
        )
    patients = query.order_by(Patient.id.desc()).offset(offset).limit(limit).all()
    return patients

@router.post("", response_model=PatientResponse)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["receptionist", "nurse", "clinic_admin", "super_admin", "patient"]))
) -> Any:
    # Generate unique MRN
    count = db.query(Patient).count() + 1
    mrn = f"PAT-{datetime.now().year}-{count:04d}"
    
    patient = Patient(
        clinic_id=patient_in.clinic_id or 1,
        mrn=mrn,
        first_name=patient_in.first_name,
        last_name=patient_in.last_name,
        dob=patient_in.dob,
        gender=patient_in.gender,
        phone=patient_in.phone,
        email=patient_in.email,
        address=patient_in.address,
        city=patient_in.city,
        blood_group=patient_in.blood_group,
        allergies=patient_in.allergies or "None",
        chronic_conditions=patient_in.chronic_conditions or "None",
        current_medications=patient_in.current_medications or "None",
        emergency_contact_name=patient_in.emergency_contact_name,
        emergency_contact_phone=patient_in.emergency_contact_phone,
        insurance_provider=patient_in.insurance_provider,
        insurance_policy_number=patient_in.insurance_policy_number,
        qr_code_token=f"QR-{mrn}",
        is_senior=patient_in.is_senior or False
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    
    log_audit_event(
        db=db,
        action="PATIENT_REGISTRATION",
        resource_type="Patient",
        resource_id=str(patient.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"mrn": mrn, "name": f"{patient.first_name} {patient.last_name}"}
    )
    return patient

@router.get("/{patient_id}")
def get_patient_profile(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    log_audit_event(
        db=db,
        action="VIEW_PATIENT_PROFILE",
        resource_type="Patient",
        resource_id=str(patient.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"]
    )
    return patient

@router.get("/{patient_id}/records")
def get_longitudinal_ehr_timeline(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
        
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient_id).order_by(Encounter.start_time.desc()).all()
    timeline = []
    
    for enc in encounters:
        enc_data = {
            "encounter_id": enc.id,
            "encounter_code": enc.encounter_code,
            "date": enc.start_time.strftime("%Y-%m-%d %H:%M") if enc.start_time else "N/A",
            "doctor_name": f"Dr. {enc.doctor.user.full_name if enc.doctor and enc.doctor.user else 'Specialist'}",
            "specialty": enc.doctor.specialty if enc.doctor else "General Medicine",
            "chief_complaint": enc.chief_complaint,
            "diagnosis_title": enc.diagnosis_title,
            "diagnosis_code": enc.diagnosis_code,
            "treatment_plan": enc.treatment_plan,
            "vitals": None,
            "prescription": None,
            "lab_orders": []
        }
        
        if enc.vitals:
            enc_data["vitals"] = {
                "bp": f"{enc.vitals.systolic_bp}/{enc.vitals.diastolic_bp} mmHg",
                "pulse": f"{enc.vitals.heart_rate_bpm} bpm",
                "temp": f"{enc.vitals.temperature_f} °F",
                "spo2": f"{enc.vitals.spo2_percent}%",
                "bmi": enc.vitals.bmi,
                "triage_level": enc.vitals.triage_level
            }
            
        if enc.prescription:
            enc_data["prescription"] = {
                "code": enc.prescription.prescription_code,
                "status": enc.prescription.status,
                "items": [
                    {
                        "medicine": item.medicine.name,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                        "duration": f"{item.duration_days} days",
                        "instructions": item.instructions
                    }
                    for item in enc.prescription.items
                ]
            }
            
        for lab in enc.lab_orders:
            enc_data["lab_orders"].append({
                "test_name": lab.test.name if lab.test else "Lab Test",
                "status": lab.status,
                "sample_type": lab.test.sample_type if lab.test else "Blood",
                "results": [
                    {
                        "value": res.numeric_value or res.text_value,
                        "is_abnormal": res.is_abnormal,
                        "flags": res.flags
                    }
                    for res in lab.results
                ]
            })
            
        timeline.append(enc_data)
        
    return {
        "patient": {
            "id": patient.id,
            "mrn": patient.mrn,
            "name": f"{patient.first_name} {patient.last_name}",
            "dob": patient.dob.isoformat() if patient.dob else None,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies,
            "chronic_conditions": patient.chronic_conditions,
            "current_medications": patient.current_medications,
            "insurance": f"{patient.insurance_provider} ({patient.insurance_policy_number})"
        },
        "timeline": timeline
    }
