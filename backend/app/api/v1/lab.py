from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.models.models import LabOrder, LabTest, LabResult, Encounter, Patient, Doctor, User
from app.schemas.schemas import LabOrderCreate, LabResultCreate
from app.services.audit_service import log_audit_event, create_system_notification
from app.core.events import ws_manager

router = APIRouter()

@router.get("/tests")
def list_lab_tests_directory(db: Session = Depends(get_db)) -> Any:
    tests = db.query(LabTest).all()
    return tests

@router.get("/worklist/count")
def get_pending_lab_count(db: Session = Depends(get_db)) -> Any:
    count = db.query(LabOrder).filter(LabOrder.status.in_(["Ordered", "Sample-Collected", "In-Analysis"])).count()
    return {"pending_count": count}

@router.post("/orders")
def order_lab_test(
    order_in: LabOrderCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["doctor", "clinic_admin"]))
) -> Any:
    today_str = datetime.now().strftime("%Y%m%d")
    count = db.query(LabOrder).count() + 1
    ord_num = f"LBO-{today_str}-{count:04d}"
    barcode = f"BAR-{order_in.test_id}-{count:04d}"
    
    lab_order = LabOrder(
        order_number=ord_num,
        encounter_id=order_in.encounter_id,
        patient_id=order_in.patient_id,
        doctor_id=order_in.doctor_id,
        test_id=order_in.test_id,
        urgency=order_in.urgency or "Routine",
        status="Ordered",
        sample_barcode=barcode,
        clinical_indication=order_in.clinical_indication or "Clinical diagnostic assessment",
        ordered_at=datetime.now(timezone.utc)
    )
    db.add(lab_order)
    db.commit()
    db.refresh(lab_order)
    
    pat = lab_order.patient
    test = lab_order.test
    
    if pat and pat.user_id:
        create_system_notification(
            db=db,
            user_id=pat.user_id,
            title="Laboratory Test Ordered",
            message=f"Test '{test.name if test else 'Lab Test'}' has been requested ({ord_num}). Please proceed to Lab Collection."
        )
        
    log_audit_event(
        db=db,
        action="ORDER_LAB_TEST",
        resource_type="LabOrder",
        resource_id=ord_num,
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"order_number": ord_num, "test_id": order_in.test_id, "patient_id": order_in.patient_id}
    )
    return {
        "id": lab_order.id,
        "order_number": lab_order.order_number,
        "test_name": test.name if test else "Diagnostic Test",
        "sample_barcode": lab_order.sample_barcode,
        "status": lab_order.status
    }

@router.get("/worklist")
def get_lab_technician_worklist(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    orders = db.query(LabOrder).order_by(LabOrder.ordered_at.desc()).limit(100).all()
    worklist = []
    for o in orders:
        pat = o.patient
        worklist.append({
            "id": o.id,
            "order_number": o.order_number,
            "patient_id": o.patient_id,
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Patient",
            "patient_mrn": pat.mrn if pat else "N/A",
            "test_name": o.test.name if o.test else "Diagnostic Test",
            "test_code": o.test.code if o.test else "N/A",
            "sample_type": o.test.sample_type if o.test else "Blood",
            "sample_barcode": o.sample_barcode,
            "urgency": o.urgency,
            "status": o.status,
            "ordered_at": o.ordered_at.strftime("%Y-%m-%d %H:%M"),
            "has_results": len(o.results) > 0,
            "price": o.test.price if o.test else 25.0
        })
    return worklist

@router.put("/orders/{order_id}/collect-sample")
def mark_sample_collected(
    order_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["lab_technician", "nurse", "clinic_admin"]))
) -> Any:
    order = db.query(LabOrder).filter(LabOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found.")
    order.status = "Sample-Collected"
    db.commit()
    db.refresh(order)
    return {"message": f"Specimen collected for order {order.order_number}.", "status": order.status}

@router.post("/results")
def record_and_verify_lab_result(
    result_in: LabResultCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["lab_technician", "doctor", "clinic_admin"]))
) -> Any:
    lab_order = db.query(LabOrder).filter(LabOrder.id == result_in.lab_order_id).first()
    if not lab_order:
        raise HTTPException(status_code=404, detail="Lab order not found.")
        
    test = lab_order.test
    is_abnormal = result_in.is_abnormal or False
    flags = result_in.flags
    
    # Auto-flag against test reference ranges if numeric
    if test and result_in.numeric_value is not None:
        if test.normal_range_max and result_in.numeric_value > test.normal_range_max:
            is_abnormal = True
            flags = "HIGH"
        elif test.normal_range_min and result_in.numeric_value < test.normal_range_min:
            is_abnormal = True
            flags = "LOW"
        else:
            flags = "NORMAL"
            
    result = LabResult(
        lab_order_id=result_in.lab_order_id,
        numeric_value=result_in.numeric_value,
        text_value=result_in.text_value,
        is_abnormal=is_abnormal,
        flags=flags,
        technician_notes=result_in.technician_notes or "Specimen analyzed, verified and electronically released.",
        verified_by_id=int(payload["sub"]),
        verified_at=datetime.now(timezone.utc)
    )
    db.add(result)
    lab_order.status = "Completed"
    
    db.commit()
    db.refresh(result)
    
    pat = lab_order.patient
    doc = lab_order.doctor
    
    if pat and pat.user_id:
        create_system_notification(
            db=db,
            user_id=pat.user_id,
            title="Lab Result Released",
            message=f"Your diagnostic test result for {test.name if test else 'Lab Test'} is verified and released. Status: {flags or 'Normal'}."
        )
    if doc and doc.user_id:
        create_system_notification(
            db=db,
            user_id=doc.user_id,
            title="Lab Report Ready",
            message=f"Lab report ready for patient {pat.first_name} {pat.last_name}: {test.name if test else 'Test'} ({flags or 'Normal'})."
        )
        
    log_audit_event(
        db=db,
        action="VERIFY_LAB_RESULT",
        resource_type="LabResult",
        resource_id=str(result.id),
        user_id=int(payload["sub"]),
        user_role=payload["role"],
        details={"order_number": lab_order.order_number, "is_abnormal": is_abnormal, "flags": flags}
    )
    return {"message": "Lab result verified and report finalized.", "result_id": result.id, "status": "Completed", "flags": flags}

@router.get("/patient/{patient_id}")
def get_patient_lab_reports(
    patient_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    orders = db.query(LabOrder).filter(LabOrder.patient_id == patient_id).order_by(LabOrder.ordered_at.desc()).all()
    reports = []
    for o in orders:
        results_data = []
        for r in o.results:
            results_data.append({
                "value": r.numeric_value if r.numeric_value is not None else r.text_value,
                "is_abnormal": r.is_abnormal,
                "flags": r.flags,
                "reference_range": o.test.normal_range_text if o.test else "Normal",
                "unit": o.test.unit if o.test else "",
                "notes": r.technician_notes,
                "verified_at": r.verified_at.strftime("%Y-%m-%d %H:%M") if r.verified_at else None
            })
            
        reports.append({
            "order_number": o.order_number,
            "test_name": o.test.name if o.test else "Lab Test",
            "sample_type": o.test.sample_type if o.test else "Blood",
            "status": o.status,
            "ordered_at": o.ordered_at.strftime("%Y-%m-%d %H:%M"),
            "results": results_data
        })
    return reports
