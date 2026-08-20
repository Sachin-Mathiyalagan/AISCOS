from datetime import datetime, timezone, date
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Prescription, PrescriptionItem, Medicine, InventoryBatch, Invoice, InvoiceItem

class PharmacyService:
    def dispense_prescription(
        self,
        db: Session,
        prescription_id: int,
        item_ids: Optional[List[int]] = None
    ) -> Prescription:
        prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if not prescription:
            raise ValueError(f"Prescription with ID {prescription_id} not found.")
            
        items_to_dispense = prescription.items
        if item_ids:
            items_to_dispense = [i for i in prescription.items if i.id in item_ids]
            
        # 1. First pass: Validate full stock availability for all items to guarantee atomic dispensing
        for item in items_to_dispense:
            if item.is_dispensed:
                continue
                
            total_stock = sum(
                b.quantity_in_stock for b in db.query(InventoryBatch).filter(
                    InventoryBatch.medicine_id == item.medicine_id,
                    InventoryBatch.quantity_in_stock > 0
                ).all()
            )
            
            if total_stock < item.quantity:
                med_name = item.medicine.name if item.medicine else f"Medicine #{item.medicine_id}"
                raise ValueError(
                    f"Insufficient stock for {med_name}. Required: {item.quantity} units, Total Available Stock: {total_stock} units. Please replenish batch inventory."
                )
                
        # 2. Second pass: Execute FEFO (First-Expiry-First-Out) batch deduction
        for item in items_to_dispense:
            if item.is_dispensed:
                continue
                
            qty_needed = item.quantity
            batches = db.query(InventoryBatch).filter(
                InventoryBatch.medicine_id == item.medicine_id,
                InventoryBatch.quantity_in_stock > 0
            ).order_by(InventoryBatch.expiry_date.asc()).all()
            
            total_dispensed = 0
            for batch in batches:
                if qty_needed <= 0:
                    break
                deduct = min(batch.quantity_in_stock, qty_needed)
                batch.quantity_in_stock -= deduct
                qty_needed -= deduct
                total_dispensed += deduct
                
            item.is_dispensed = True
            item.dispensed_quantity = total_dispensed
            
        all_dispensed = all(i.is_dispensed for i in prescription.items)
        prescription.status = "Dispensed" if all_dispensed else "Partially-Dispensed"
        
        db.commit()
        db.refresh(prescription)
        return prescription

    def add_inventory_batch(
        self,
        db: Session,
        medicine_id: int,
        batch_number: str,
        expiry_date: date,
        quantity: int,
        cost_price: float = 5.0,
        unit_selling_price: float = 10.0,
        supplier_name: str = "Apex Healthcare Global",
        clinic_id: int = 1
    ) -> InventoryBatch:
        medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
        if not medicine:
            raise ValueError(f"Medicine with ID {medicine_id} not found.")
            
        batch = InventoryBatch(
            medicine_id=medicine_id,
            clinic_id=clinic_id,
            batch_number=batch_number,
            expiry_date=expiry_date,
            quantity_in_stock=quantity,
            reorder_level=20,
            cost_price=cost_price,
            unit_selling_price=unit_selling_price,
            supplier_name=supplier_name
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        return batch

    def get_inventory_summary(self, db: Session) -> List[dict]:
        medicines = db.query(Medicine).all()
        summary = []
        for med in medicines:
            total_stock = sum(b.quantity_in_stock for b in med.batches)
            earliest_expiry = min([b.expiry_date for b in med.batches if b.quantity_in_stock > 0], default=None)
            reorder_needed = total_stock <= (med.batches[0].reorder_level if med.batches else 20)
            summary.append({
                "medicine_id": med.id,
                "name": med.name,
                "generic_name": med.generic_name,
                "category": med.category,
                "dosage_form": med.dosage_form,
                "strength": med.strength,
                "unit_price": med.unit_price,
                "total_stock": total_stock,
                "earliest_expiry": earliest_expiry.strftime("%Y-%m-%d") if earliest_expiry else "N/A",
                "reorder_needed": reorder_needed,
                "batches_count": len(med.batches)
            })
        return summary

pharmacy_service = PharmacyService()
