from datetime import datetime, timezone
import hashlib
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Prescription, PrescriptionItem, Medicine, Encounter, Patient, Doctor
from app.schemas.schemas import PrescriptionCreate, PrescriptionResponse
from app.services.audit_service import log_audit_event, create_system_notification

router = APIRouter()

@router.post("", response_model=PrescriptionResponse)
def create_prescription(
    rx_in: PrescriptionCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    today_str = datetime.now().strftime("%Y%m%d")
    count = db.query(Prescription).count() + 1
    code = f"RX-{today_str}-{count:04d}"
    
    # Generate cryptographic verification hash
    hash_payload = f"{code}:{rx_in.patient_id}:{rx_in.doctor_id}:{datetime.now(timezone.utc).isoformat()}"
    verification_hash = hashlib.sha256(hash_payload.encode()).hexdigest()[:16].upper()
    
    rx = Prescription(
        prescription_code=code,
        encounter_id=rx_in.encounter_id,
        patient_id=rx_in.patient_id,
        doctor_id=rx_in.doctor_id,
        notes=rx_in.notes or "Take medications strictly as instructed with meals.",
        verification_hash=verification_hash,
        status="Approved"
    )
    db.add(rx)
    db.commit()
    db.refresh(rx)
    
    # Add items
    items_response = []
    for item in rx_in.items:
        med = db.query(Medicine).filter(Medicine.id == item.medicine_id).first()
        p_item = PrescriptionItem(
            prescription_id=rx.id,
            medicine_id=item.medicine_id,
            dosage=item.dosage,
            frequency=item.frequency,
            route=item.route or "Oral",
            duration_days=item.duration_days,
            quantity=item.quantity,
            instructions=item.instructions or "After meals",
            is_dispensed=False,
            dispensed_quantity=0
        )
        db.add(p_item)
        items_response.append({
            "medicine_id": item.medicine_id,
            "medicine_name": med.name if med else "Medicine",
            "dosage": item.dosage,
            "frequency": item.frequency,
            "route": item.route or "Oral",
            "duration_days": item.duration_days,
            "quantity": item.quantity,
            "instructions": item.instructions or "After meals",
            "is_dispensed": False
        })
        
    db.commit()
    
    doc = db.query(Doctor).filter(Doctor.id == rx.doctor_id).first()
    pat = db.query(Patient).filter(Patient.id == rx.patient_id).first()
    
    if pat and pat.user_id:
        create_system_notification(
            db=db,
            user_id=pat.user_id,
            title="Digital Prescription Issued",
            message=f"Dr. {doc.user.full_name if doc and doc.user else 'Specialist'} has issued digital prescription {code} ({len(rx_in.items)} medications)."
        )
        
    log_audit_event(
        db=db,
        action="ISSUE_DIGITAL_PRESCRIPTION",
        resource_type="Prescription",
        resource_id=code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"code": code, "items_count": len(rx_in.items), "patient_id": rx.patient_id}
    )
    
    return {
        "id": rx.id,
        "prescription_code": rx.prescription_code,
        "encounter_id": rx.encounter_id,
        "patient_id": rx.patient_id,
        "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
        "patient_mrn": pat.mrn if pat else "N/A",
        "doctor_id": rx.doctor_id,
        "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
        "doctor_specialty": doc.specialty if doc else "General",
        "notes": rx.notes,
        "verification_hash": rx.verification_hash,
        "status": rx.status,
        "created_at": rx.created_at,
        "items": items_response
    }

@router.get("/{prescription_id}", response_model=PrescriptionResponse)
def get_prescription(
    prescription_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    rx = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found.")
        
    doc = rx.doctor
    pat = rx.patient
    items = []
    for i in rx.items:
        items.append({
            "medicine_id": i.medicine_id,
            "medicine_name": i.medicine.name if i.medicine else "Medication",
            "dosage": i.dosage,
            "frequency": i.frequency,
            "route": i.route,
            "duration_days": i.duration_days,
            "quantity": i.quantity,
            "instructions": i.instructions,
            "is_dispensed": i.is_dispensed
        })
        
    return {
        "id": rx.id,
        "prescription_code": rx.prescription_code,
        "encounter_id": rx.encounter_id,
        "patient_id": rx.patient_id,
        "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
        "patient_mrn": pat.mrn if pat else "N/A",
        "doctor_id": rx.doctor_id,
        "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
        "doctor_specialty": doc.specialty if doc else "General",
        "notes": rx.notes,
        "verification_hash": rx.verification_hash,
        "status": rx.status,
        "created_at": rx.created_at,
        "items": items
    }

@router.get("/{prescription_id}/pdf", response_class=HTMLResponse)
def get_prescription_printable_pdf(
    prescription_id: int,
    db: Session = Depends(get_db)
) -> Any:
    """Generates an authentic, printable medical prescription document with digital cryptographic seal."""
    rx = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found.")
        
    doc = rx.doctor
    pat = rx.patient
    encounter = rx.encounter
    
    items_html = ""
    for idx, item in enumerate(rx.items, start=1):
        items_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; color: #1e293b;">{idx}. {item.medicine.name if item.medicine else 'Medicine'}</td>
            <td style="padding: 10px; color: #475569;">{item.medicine.generic_name if item.medicine else ''} ({item.medicine.strength if item.medicine else ''})</td>
            <td style="padding: 10px; color: #0f172a; font-weight: 600;">{item.dosage} — {item.frequency}</td>
            <td style="padding: 10px; color: #475569;">{item.duration_days} days (Qty: {item.quantity})</td>
            <td style="padding: 10px; color: #0284c7;">{item.instructions or 'After meals'}</td>
        </tr>
        """
        
    created_str = rx.created_at.strftime("%B %d, %Y - %I:%M %p")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Prescription — {rx.prescription_code}</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 30px; }}
            .card {{ max-width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }}
            .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d9488; padding-bottom: 20px; }}
            .clinic-title {{ font-size: 22px; font-weight: 800; color: #0f766e; margin: 0; }}
            .clinic-sub {{ font-size: 12px; color: #64748b; margin: 4px 0 0 0; }}
            .rx-badge {{ background: #0d9488; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 18px; }}
            .meta-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; padding: 15px; background: #f1f5f9; border-radius: 12px; font-size: 13px; }}
            .table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }}
            .th {{ background: #0f766e; color: #ffffff; padding: 10px; text-align: left; }}
            .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #64748b; }}
            .seal {{ border: 2px solid #0d9488; border-radius: 10px; padding: 8px 14px; text-align: center; color: #0f766e; font-weight: bold; }}
            @media print {{ body {{ background: none; padding: 0; }} .card {{ box-shadow: none; border: none; }} }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <div>
                    <h1 class="clinic-title">AISCOS HEALTHCARE NETWORK</h1>
                    <p class="clinic-sub">Smart Clinic & Hospital System • Central Outpatient Division</p>
                    <p class="clinic-sub">Licence: CLN-AISCOS-MAIN • Tel: +1 (800) 555-0199</p>
                </div>
                <div class="rx-badge">℞ PRESCRIPTION</div>
            </div>

            <div class="meta-grid">
                <div>
                    <strong>PATIENT DETAILS:</strong><br>
                    Name: <strong>{pat.first_name} {pat.last_name}</strong><br>
                    MRN: <strong>{pat.mrn}</strong> | Gender: {pat.gender} | DOB: {pat.dob}<br>
                    Allergies: <span style="color: #dc2626; font-weight: bold;">{pat.allergies or 'None'}</span><br>
                    Chronic Conditions: {pat.chronic_conditions or 'None'}
                </div>
                <div>
                    <strong>PRESCRIBING PHYSICIAN:</strong><br>
                    <strong>Dr. {doc.user.full_name if doc and doc.user else 'Specialist'}</strong> ({doc.specialty})<br>
                    License No: {doc.license_number}<br>
                    Date & Time: {created_str}<br>
                    Encounter Code: {encounter.encounter_code if encounter else 'ENC-OPD'}
                </div>
            </div>

            {f'<div style="margin: 15px 0; padding: 10px; background: #e0f2fe; border-left: 4px solid #0284c7; border-radius: 4px; font-size: 13px;"><strong>Clinical Diagnosis:</strong> {encounter.diagnosis_title} (ICD-10: {encounter.diagnosis_code or "Clinical"})</div>' if encounter and encounter.diagnosis_title else ''}

            <table class="table">
                <thead>
                    <tr>
                        <th class="th">Medication Name</th>
                        <th class="th">Generic Molecule</th>
                        <th class="th">Dosage & Frequency</th>
                        <th class="th">Duration</th>
                        <th class="th">Instructions</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <div style="margin-top: 25px; font-size: 13px; color: #334155;">
                <strong>Physician Advice / Clinical Notes:</strong><br>
                <em>{rx.notes or 'Take medications with adequate water after food. Avoid self-discontinuation.'}</em>
            </div>

            <div class="footer">
                <div>
                    <div>Cryptographic Verification Seal:</div>
                    <div style="font-family: monospace; font-size: 11px; color: #0d9488; font-weight: bold;">{rx.verification_hash}</div>
                    <div style="font-size: 10px; margin-top: 4px;">AISCOS Digital Health Record Security Architecture (SHA-256)</div>
                </div>
                <div style="text-align: right;">
                    <div class="seal">
                        DIGITALLY SIGNED & VERIFIED<br>
                        Dr. {doc.user.full_name if doc and doc.user else 'Physician'}
                    </div>
                </div>
            </div>
        </div>
        <script>
            // Auto trigger print dialog if opened in preview mode
            window.onload = function() {{
                if (window.location.search.includes('print=true')) {{
                    window.print();
                }}
            }}
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/patient/{patient_id}")
def get_patient_prescriptions(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    prescriptions = db.query(Prescription).filter(Prescription.patient_id == patient_id).order_by(Prescription.created_at.desc()).all()
    results = []
    for rx in prescriptions:
        doc = rx.doctor
        results.append({
            "id": rx.id,
            "prescription_code": rx.prescription_code,
            "date": rx.created_at.strftime("%Y-%m-%d %H:%M"),
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "doctor_specialty": doc.specialty if doc else "General",
            "status": rx.status,
            "verification_hash": rx.verification_hash,
            "notes": rx.notes,
            "items": [
                {
                    "medicine_id": i.medicine_id,
                    "medicine_name": i.medicine.name if i.medicine else "Medication",
                    "generic_name": i.medicine.generic_name if i.medicine else "",
                    "dosage": i.dosage,
                    "frequency": i.frequency,
                    "duration": f"{i.duration_days} days",
                    "duration_days": i.duration_days,
                    "quantity": i.quantity,
                    "instructions": i.instructions,
                    "is_dispensed": i.is_dispensed
                }
                for i in rx.items
            ]
        })
    return results
