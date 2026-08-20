from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Invoice, InvoiceItem, Payment, InsuranceClaim, Encounter, Patient, Doctor

class BillingService:
    def generate_encounter_invoice(self, db: Session, encounter_id: int) -> Invoice:
        encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
        if not encounter:
            raise ValueError("Encounter not found.")
            
        if encounter.invoice:
            return encounter.invoice
            
        today_str = datetime.now().strftime("%Y%m%d")
        inv_count = db.query(Invoice).count() + 1
        invoice_number = f"INV-{today_str}-{inv_count:04d}"
        
        items = []
        subtotal = 0.0
        
        # 1. Doctor Consultation Fee
        doc_fee = encounter.doctor.consultation_fee if encounter.doctor else 500.0
        items.append(InvoiceItem(
            item_type="Consultation",
            description=f"Consultation Fee - Dr. {encounter.doctor.user.full_name if encounter.doctor else 'Specialist'}",
            quantity=1,
            unit_price=doc_fee,
            total_price=doc_fee
        ))
        subtotal += doc_fee
        
        # 2. Pharmacy items if any
        if encounter.prescription:
            for p_item in encounter.prescription.items:
                med_price = p_item.medicine.unit_price * p_item.quantity
                items.append(InvoiceItem(
                    item_type="Pharmacy",
                    description=f"{p_item.medicine.name} ({p_item.medicine.strength}) x{p_item.quantity}",
                    quantity=p_item.quantity,
                    unit_price=p_item.medicine.unit_price,
                    total_price=med_price
                ))
                subtotal += med_price
                
        # 3. Lab Orders if any
        for l_order in encounter.lab_orders:
            lab_price = l_order.test.price if l_order.test else 300.0
            items.append(InvoiceItem(
                item_type="Lab",
                description=f"Lab Diagnostic: {l_order.test.name if l_order.test else 'Standard Panel'}",
                quantity=1,
                unit_price=lab_price,
                total_price=lab_price
            ))
            subtotal += lab_price
            
        tax = round(subtotal * 0.05, 2) # 5% healthcare tax/service
        total = round(subtotal + tax, 2)
        
        invoice = Invoice(
            invoice_number=invoice_number,
            clinic_id=encounter.clinic_id,
            patient_id=encounter.patient_id,
            encounter_id=encounter.id,
            subtotal=subtotal,
            discount=0.0,
            tax=tax,
            total_amount=total,
            paid_amount=0.0,
            payment_status="Unpaid"
        )
        invoice.items = items
        
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        return invoice

    def record_payment(
        self,
        db: Session,
        invoice_id: int,
        payment_method: str,
        amount: float,
        transaction_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Payment:
        invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not invoice:
            raise ValueError("Invoice not found.")
            
        today_str = datetime.now().strftime("%Y%m%d")
        pay_count = db.query(Payment).count() + 1
        ref = f"PAY-{today_str}-{pay_count:04d}"
        
        payment = Payment(
            payment_reference=ref,
            invoice_id=invoice_id,
            payment_method=payment_method,
            amount=amount,
            transaction_id=transaction_id or f"TXN-{datetime.now().timestamp()}",
            notes=notes
        )
        
        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.total_amount:
            invoice.payment_status = "Paid"
        elif invoice.paid_amount > 0:
            invoice.payment_status = "Partially-Paid"
            
        db.add(payment)
        db.commit()
        db.refresh(payment)
        return payment

billing_service = BillingService()
