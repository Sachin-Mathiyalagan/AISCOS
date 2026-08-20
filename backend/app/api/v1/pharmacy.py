from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Medicine, InventoryBatch, Prescription, PrescriptionItem, Patient
from app.schemas.schemas import DispenseRequest, InventoryStockCreate
from app.services.pharmacy_service import pharmacy_service
from app.services.audit_service import log_audit_event, create_system_notification
from app.core.events import ws_manager

router = APIRouter()

@router.get("/inventory")
def get_pharmacy_inventory(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    return pharmacy_service.get_inventory_summary(db)

@router.get("/prescriptions/pending/count")
def get_pending_prescriptions_count(db: Session = Depends(get_db)) -> Any:
    count = db.query(Prescription).filter(Prescription.status.in_(["Approved", "Partially-Dispensed"])).count()
    return {"pending_count": count}

@router.get("/prescriptions/pending")
def list_pending_dispensations(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["pharmacist", "doctor", "clinic_admin"]))
) -> Any:
    prescriptions = db.query(Prescription).filter(Prescription.status.in_(["Approved", "Partially-Dispensed"])).order_by(Prescription.created_at.desc()).all()
    results = []
    for rx in prescriptions:
        pat = rx.encounter.patient if rx.encounter else None
        doc = rx.encounter.doctor if rx.encounter else None
        results.append({
            "id": rx.id,
            "prescription_code": rx.prescription_code,
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "patient_mrn": pat.mrn if pat else "N/A",
            "doctor_name": doc.user.full_name if doc and doc.user else "Doctor",
            "date": rx.created_at.strftime("%Y-%m-%d %H:%M"),
            "status": rx.status,
            "items": [
                {
                    "item_id": item.id,
                    "medicine_id": item.medicine_id,
                    "medicine_name": item.medicine.name if item.medicine else "Medicine",
                    "dosage": item.dosage,
                    "frequency": item.frequency,
                    "quantity": item.quantity,
                    "is_dispensed": item.is_dispensed
                }
                for item in rx.items
            ]
        })
    return results

@router.post("/dispense")
async def dispense_medications(
    dispense_req: DispenseRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["pharmacist", "clinic_admin"]))
) -> Any:
    try:
        rx = pharmacy_service.dispense_prescription(
            db=db,
            prescription_id=dispense_req.prescription_id,
            item_ids=dispense_req.item_ids
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    pat = rx.patient
    if pat and pat.user_id:
        create_system_notification(
            db=db,
            user_id=pat.user_id,
            title="Medications Dispensed",
            message=f"Your prescription {rx.prescription_code} has been dispensed by the pharmacy via verified FEFO inventory."
        )
        
    await ws_manager.broadcast_to_channel(
        "clinic:1:queue",
        {
            "event": "MEDICATION_DISPENSED",
            "prescription_code": rx.prescription_code,
            "status": rx.status
        }
    )
        
    log_audit_event(
        db=db,
        action="DISPENSE_MEDICATION_FEFO",
        resource_type="Prescription",
        resource_id=rx.prescription_code,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"status": rx.status, "code": rx.prescription_code}
    )
    return {"message": "Prescription successfully dispensed via First-Expiry-First-Out (FEFO) batches.", "prescription_code": rx.prescription_code, "status": rx.status}

@router.post("/inventory/stock")
def add_inventory_stock_batch(
    stock_in: InventoryStockCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["pharmacist", "clinic_admin"]))
) -> Any:
    try:
        batch = pharmacy_service.add_inventory_batch(
            db=db,
            medicine_id=stock_in.medicine_id,
            batch_number=stock_in.batch_number,
            expiry_date=stock_in.expiry_date,
            quantity=stock_in.quantity_in_stock,
            cost_price=stock_in.cost_price or 5.0,
            unit_selling_price=stock_in.unit_selling_price or 10.0,
            supplier_name=stock_in.supplier_name or "Apex Healthcare Global"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    log_audit_event(
        db=db,
        action="RESTOCK_MEDICATION_BATCH",
        resource_type="InventoryBatch",
        resource_id=batch.batch_number,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"batch_number": batch.batch_number, "quantity": batch.quantity_in_stock}
    )
    return {
        "message": f"Batch {batch.batch_number} successfully added to inventory.",
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "quantity_in_stock": batch.quantity_in_stock
    }
