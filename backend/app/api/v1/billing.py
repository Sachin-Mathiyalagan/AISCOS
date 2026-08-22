from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import Invoice, InvoiceItem, Payment, InsuranceClaim, Patient, Encounter
from app.schemas.schemas import PaymentCreate, InvoiceResponse
from app.services.billing_service import billing_service
from app.services.audit_service import log_audit_event, create_system_notification
from app.core.events import ws_manager

router = APIRouter()

@router.get("/invoices")
def list_invoices(
    patient_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    query = db.query(Invoice)
    if patient_id:
        query = query.filter(Invoice.patient_id == patient_id)
    if status_filter:
        query = query.filter(Invoice.payment_status == status_filter)
        
    invoices = query.order_by(Invoice.created_at.desc()).limit(limit).all()
    results = []
    for inv in invoices:
        pat = inv.patient
        items_data = [
            {
                "item_type": item.item_type,
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price
            }
            for item in inv.items
        ]
        payments_data = [
            {
                "reference": p.payment_reference,
                "method": p.payment_method,
                "amount": p.amount,
                "date": p.payment_date.strftime("%Y-%m-%d %H:%M")
            }
            for p in inv.payments
        ]
        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "patient_id": inv.patient_id,
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "patient_mrn": pat.mrn if pat else "N/A",
            "encounter_id": inv.encounter_id,
            "subtotal": inv.subtotal,
            "discount": inv.discount,
            "tax": inv.tax,
            "total_amount": inv.total_amount,
            "paid_amount": inv.paid_amount,
            "payment_status": inv.payment_status,
            "created_at": inv.created_at.strftime("%Y-%m-%d %H:%M"),
            "items": items_data,
            "payments": payments_data
        })
    return results

@router.get("/invoices/{invoice_id}")
def get_invoice_details(
    invoice_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    pat = inv.patient
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "patient_id": inv.patient_id,
        "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
        "patient_mrn": pat.mrn if pat else "N/A",
        "encounter_id": inv.encounter_id,
        "subtotal": inv.subtotal,
        "discount": inv.discount,
        "tax": inv.tax,
        "total_amount": inv.total_amount,
        "paid_amount": inv.paid_amount,
        "payment_status": inv.payment_status,
        "created_at": inv.created_at.strftime("%Y-%m-%d %H:%M"),
        "items": [
            {
                "item_type": i.item_type,
                "description": i.description,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "total_price": i.total_price
            }
            for i in inv.items
        ],
        "payments": [
            {
                "reference": p.payment_reference,
                "method": p.payment_method,
                "amount": p.amount,
                "date": p.payment_date.strftime("%Y-%m-%d %H:%M")
            }
            for p in inv.payments
        ]
    }

@router.post("/generate/{encounter_id}")
def generate_encounter_invoice(
    encounter_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["billing_staff", "receptionist", "clinic_admin", "doctor"]))
) -> Any:
    try:
        inv = billing_service.generate_encounter_invoice(db, encounter_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    log_audit_event(
        db=db,
        action="GENERATE_INVOICE",
        resource_type="Invoice",
        resource_id=str(inv.invoice_number),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"invoice_number": inv.invoice_number, "total": inv.total_amount}
    )
    return {
        "message": "Consolidated invoice generated successfully.",
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "total_amount": inv.total_amount
    }

@router.post("/payments")
async def process_payment(
    payment_in: PaymentCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    try:
        payment = billing_service.record_payment(
            db=db,
            invoice_id=payment_in.invoice_id,
            payment_method=payment_in.payment_method,
            amount=payment_in.amount,
            transaction_id=payment_in.transaction_id,
            notes=payment_in.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    inv = payment.invoice
    pat = inv.patient
    
    if pat and pat.user_id:
        create_system_notification(
            db=db,
            user_id=pat.user_id,
            title="Payment Received — Receipt Generated",
            message=f"Payment of ${payment.amount:.2f} via {payment.payment_method} received for Invoice {inv.invoice_number}. Status: {inv.payment_status}."
        )
        
    await ws_manager.broadcast_to_channel(
        "clinic:1:queue",
        {
            "event": "PAYMENT_COMPLETED",
            "invoice_number": inv.invoice_number,
            "status": inv.payment_status,
            "amount": payment.amount
        }
    )
        
    log_audit_event(
        db=db,
        action="RECORD_PAYMENT",
        resource_type="Payment",
        resource_id=str(payment.payment_reference),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"amount": payment.amount, "method": payment.payment_method, "invoice": inv.invoice_number}
    )
    return {
        "message": "Payment recorded successfully.",
        "payment_reference": payment.payment_reference,
        "amount": payment.amount,
        "payment_status": inv.payment_status,
        "total_amount": inv.total_amount,
        "paid_amount": inv.paid_amount
    }
