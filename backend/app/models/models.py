from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Date, ForeignKey, JSON, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=utcnow)
    
    clinics = relationship("Clinic", back_populates="organization")

class Clinic(Base):
    __tablename__ = "clinics"
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    address = Column(String(300))
    city = Column(String(100))
    phone = Column(String(50))
    email = Column(String(100))
    created_at = Column(DateTime, default=utcnow)
    
    organization = relationship("Organization", back_populates="clinics")
    departments = relationship("Department", back_populates="clinic")
    users = relationship("User", back_populates="clinic")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    floor = Column(String(50))
    description = Column(String(255))
    
    clinic = relationship("Clinic", back_populates="departments")
    doctors = relationship("Doctor", back_populates="department")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=True)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(50), index=True)
    role = Column(String(50), nullable=False, index=True) # super_admin, clinic_admin, doctor, nurse, receptionist, pharmacist, lab_technician, billing_staff, patient
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    
    clinic = relationship("Clinic", back_populates="users")
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")

class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    license_number = Column(String(100), unique=True, nullable=False)
    specialty = Column(String(100), nullable=False)
    qualification = Column(String(150))
    room_number = Column(String(50))
    consultation_fee = Column(Float, default=500.0)
    avg_consultation_time = Column(Integer, default=15) # minutes
    is_available = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="doctor_profile")
    department = relationship("Department", back_populates="doctors")
    schedules = relationship("DoctorSchedule", back_populates="doctor")
    appointments = relationship("Appointment", back_populates="doctor")
    queue_entries = relationship("QueueEntry", back_populates="doctor")
    encounters = relationship("Encounter", back_populates="doctor")

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"
    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False) # 0=Mon, 6=Sun
    start_time = Column(String(10), nullable=False) # "09:00"
    end_time = Column(String(10), nullable=False) # "17:00"
    slot_duration_mins = Column(Integer, default=15)
    is_active = Column(Boolean, default=True)
    
    doctor = relationship("Doctor", back_populates="schedules")

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=True)
    mrn = Column(String(50), unique=True, index=True, nullable=False) # Medical Record Number (e.g. PAT-2026-0001)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    dob = Column(Date, nullable=False)
    gender = Column(String(20), nullable=False) # Male, Female, Other
    phone = Column(String(50), index=True, nullable=False)
    email = Column(String(150), index=True)
    address = Column(String(255))
    city = Column(String(100))
    blood_group = Column(String(10)) # A+, O+, B+, AB-, etc.
    allergies = Column(Text, default="None") # e.g. Penicillin, Sulfa, Peanuts
    chronic_conditions = Column(Text, default="None") # e.g. Hypertension, Type 2 Diabetes
    current_medications = Column(Text, default="None")
    emergency_contact_name = Column(String(100))
    emergency_contact_phone = Column(String(50))
    insurance_provider = Column(String(100))
    insurance_policy_number = Column(String(100))
    qr_code_token = Column(String(100), unique=True, index=True)
    is_senior = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient")
    queue_entries = relationship("QueueEntry", back_populates="patient")
    encounters = relationship("Encounter", back_populates="patient")
    invoices = relationship("Invoice", back_populates="patient")
    feedback = relationship("Feedback", back_populates="patient")

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    appointment_code = Column(String(50), unique=True, index=True) # e.g. APT-2026-0818-01
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_date = Column(Date, nullable=False, index=True)
    slot_time = Column(String(10), nullable=False) # "10:30"
    appointment_type = Column(String(50), default="Routine") # Routine, Follow-up, Specialist, Emergency, Walk-in
    status = Column(String(50), default="Scheduled", index=True) # Scheduled, Checked-In, Completed, Cancelled, No-Show
    chief_complaint = Column(String(255))
    is_walk_in = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    
    doctor = relationship("Doctor", back_populates="appointments")
    patient = relationship("Patient", back_populates="appointments")
    queue_entry = relationship("QueueEntry", back_populates="appointment", uselist=False)
    encounter = relationship("Encounter", back_populates="appointment", uselist=False)

class QueueEntry(Base):
    __tablename__ = "queue_entries"
    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String(50), nullable=False, index=True) # e.g. A-104, EM-001
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    status = Column(String(50), default="Waiting", index=True) # Waiting, Called, In-Consultation, Completed, Skipped, Transferred
    priority_score = Column(Float, default=50.0, index=True) # Calculated multi-factor score
    is_emergency = Column(Boolean, default=False)
    triage_level = Column(Integer, default=4) # 1=Resuscitation, 2=Emergent, 3=Urgent, 4=Routine
    check_in_time = Column(DateTime, default=utcnow)
    called_time = Column(DateTime, nullable=True)
    consultation_start_time = Column(DateTime, nullable=True)
    consultation_end_time = Column(DateTime, nullable=True)
    estimated_wait_minutes = Column(Integer, default=15)
    confidence_interval_min = Column(Integer, default=10)
    confidence_interval_max = Column(Integer, default=20)
    queue_position = Column(Integer, default=1)
    
    doctor = relationship("Doctor", back_populates="queue_entries")
    patient = relationship("Patient", back_populates="queue_entries")
    appointment = relationship("Appointment", back_populates="queue_entry")
    encounter = relationship("Encounter", back_populates="queue_entry", uselist=False)

class Encounter(Base):
    __tablename__ = "encounters"
    id = Column(Integer, primary_key=True, index=True)
    encounter_code = Column(String(50), unique=True, index=True) # e.g. ENC-2026-001
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    queue_entry_id = Column(Integer, ForeignKey("queue_entries.id"), nullable=True)
    encounter_type = Column(String(50), default="Outpatient")
    chief_complaint = Column(Text)
    examination_notes = Column(Text)
    diagnosis_code = Column(String(50)) # ICD-10 Code e.g. J06.9, I10
    diagnosis_title = Column(String(200)) # e.g. Acute Upper Respiratory Infection, Essential Hypertension
    treatment_plan = Column(Text)
    doctor_notes = Column(Text)
    start_time = Column(DateTime, default=utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(50), default="In-Progress") # In-Progress, Completed
    
    doctor = relationship("Doctor", back_populates="encounters")
    patient = relationship("Patient", back_populates="encounters")
    appointment = relationship("Appointment", back_populates="encounter")
    queue_entry = relationship("QueueEntry", back_populates="encounter")
    vitals = relationship("Vitals", back_populates="encounter", uselist=False)
    clinical_note = relationship("ClinicalNote", back_populates="encounter", uselist=False)
    prescription = relationship("Prescription", back_populates="encounter", uselist=False)
    lab_orders = relationship("LabOrder", back_populates="encounter")
    invoice = relationship("Invoice", back_populates="encounter", uselist=False)
    follow_up = relationship("FollowUp", back_populates="encounter", uselist=False)

class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    temperature_f = Column(Float) # e.g. 98.6
    systolic_bp = Column(Integer) # e.g. 120
    diastolic_bp = Column(Integer) # e.g. 80
    heart_rate_bpm = Column(Integer) # e.g. 72
    respiratory_rate = Column(Integer) # e.g. 16
    spo2_percent = Column(Integer) # e.g. 98
    weight_kg = Column(Float) # e.g. 70.5
    height_cm = Column(Float) # e.g. 175.0
    bmi = Column(Float) # e.g. 23.0
    pain_score = Column(Integer, default=0) # 0 to 10 scale
    triage_level = Column(Integer, default=4) # 1 to 4
    triage_notes = Column(Text)
    recorded_at = Column(DateTime, default=utcnow)
    
    encounter = relationship("Encounter", back_populates="vitals")

class ClinicalNote(Base):
    __tablename__ = "clinical_notes"
    id = Column(Integer, primary_key=True, index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    subjective = Column(Text)
    objective = Column(Text)
    assessment = Column(Text)
    plan = Column(Text)
    ai_speech_transcript = Column(Text, nullable=True)
    ai_suggested_draft = Column(Text, nullable=True)
    is_signed = Column(Boolean, default=False)
    signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    
    encounter = relationship("Encounter", back_populates="clinical_note")

class Medicine(Base):
    __tablename__ = "medicines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True) # Brand Name e.g. Augmentin 625 Duo
    generic_name = Column(String(200), nullable=False, index=True) # Amoxicillin + Clavulanic Acid
    category = Column(String(100)) # Antibiotic, Antihypertensive, Analgesic, Antidiabetic, etc.
    dosage_form = Column(String(50)) # Tablet, Capsule, Syrup, Injection, Ointment
    strength = Column(String(50)) # 500mg, 10mg, 250mg/5ml
    unit_price = Column(Float, default=10.0)
    requires_prescription = Column(Boolean, default=True)
    side_effects = Column(Text)
    
    batches = relationship("InventoryBatch", back_populates="medicine")
    prescription_items = relationship("PrescriptionItem", back_populates="medicine")

class InventoryBatch(Base):
    __tablename__ = "inventory_batches"
    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    batch_number = Column(String(50), nullable=False, index=True)
    expiry_date = Column(Date, nullable=False, index=True)
    quantity_in_stock = Column(Integer, default=100)
    reorder_level = Column(Integer, default=20)
    cost_price = Column(Float, default=5.0)
    unit_selling_price = Column(Float, default=10.0)
    supplier_name = Column(String(150), default="Apex Pharma Ltd")
    created_at = Column(DateTime, default=utcnow)
    
    medicine = relationship("Medicine", back_populates="batches")

class Prescription(Base):
    __tablename__ = "prescriptions"
    id = Column(Integer, primary_key=True, index=True)
    prescription_code = Column(String(50), unique=True, index=True) # e.g. RX-2026-001
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    notes = Column(Text)
    verification_hash = Column(String(100))
    status = Column(String(50), default="Approved") # Approved, Dispensed, Partially-Dispensed
    created_at = Column(DateTime, default=utcnow)
    
    encounter = relationship("Encounter", back_populates="prescription")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")

class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    dosage = Column(String(50), nullable=False) # e.g. 1 tablet, 5ml
    frequency = Column(String(50), nullable=False) # e.g. TDS (3 times a day), BD (2 times a day), OD
    route = Column(String(50), default="Oral") # Oral, Topical, IV, IM
    duration_days = Column(Integer, default=5)
    quantity = Column(Integer, default=15)
    instructions = Column(String(200)) # e.g. After meals with water
    is_dispensed = Column(Boolean, default=False)
    dispensed_quantity = Column(Integer, default=0)
    
    prescription = relationship("Prescription", back_populates="items")
    medicine = relationship("Medicine", back_populates="prescription_items")

class LabTest(Base):
    __tablename__ = "lab_tests"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False) # e.g. Complete Blood Count (CBC)
    code = Column(String(50), unique=True, index=True) # e.g. LAB-CBC-01
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    sample_type = Column(String(50), default="Blood") # Blood, Urine, Serum, Swab
    normal_range_min = Column(Float, nullable=True)
    normal_range_max = Column(Float, nullable=True)
    normal_range_text = Column(String(100), nullable=True) # e.g. "4.0 - 11.0 x10^3/uL"
    unit = Column(String(50), nullable=True)
    price = Column(Float, default=300.0)
    turnaround_hours = Column(Integer, default=4)
    
    orders = relationship("LabOrder", back_populates="test")

class LabOrder(Base):
    __tablename__ = "lab_orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True) # e.g. LBO-2026-001
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    test_id = Column(Integer, ForeignKey("lab_tests.id"), nullable=False)
    urgency = Column(String(50), default="Routine") # Routine, Stat / Urgent
    status = Column(String(50), default="Ordered", index=True) # Ordered, Sample-Collected, In-Analysis, Completed, Cancelled
    sample_barcode = Column(String(50), nullable=True)
    clinical_indication = Column(String(255))
    ordered_at = Column(DateTime, default=utcnow)
    
    encounter = relationship("Encounter", back_populates="lab_orders")
    patient = relationship("Patient")
    doctor = relationship("Doctor")
    test = relationship("LabTest", back_populates="orders")
    results = relationship("LabResult", back_populates="lab_order")

class LabResult(Base):
    __tablename__ = "lab_results"
    id = Column(Integer, primary_key=True, index=True)
    lab_order_id = Column(Integer, ForeignKey("lab_orders.id"), nullable=False)
    numeric_value = Column(Float, nullable=True)
    text_value = Column(String(255), nullable=True)
    is_abnormal = Column(Boolean, default=False)
    flags = Column(String(50), nullable=True) # High, Low, Critical
    technician_notes = Column(Text)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    
    lab_order = relationship("LabOrder", back_populates="results")

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True) # e.g. INV-2026-001
    clinic_id = Column(Integer, ForeignKey("clinics.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    subtotal = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    payment_status = Column(String(50), default="Unpaid", index=True) # Unpaid, Partially-Paid, Paid, Refunded
    created_at = Column(DateTime, default=utcnow)
    
    patient = relationship("Patient", back_populates="invoices")
    encounter = relationship("Encounter", back_populates="invoice")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice")
    insurance_claims = relationship("InsuranceClaim", back_populates="invoice")

class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    item_type = Column(String(50), nullable=False) # Consultation, Pharmacy, Lab, Procedure
    description = Column(String(200), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0.0)
    total_price = Column(Float, default=0.0)
    
    invoice = relationship("Invoice", back_populates="items")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    payment_reference = Column(String(50), unique=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    payment_method = Column(String(50), default="Cash") # Cash, Card, UPI, Insurance
    amount = Column(Float, nullable=False)
    transaction_id = Column(String(100), nullable=True)
    payment_date = Column(DateTime, default=utcnow)
    notes = Column(String(255))
    
    invoice = relationship("Invoice", back_populates="payments")

class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"
    id = Column(Integer, primary_key=True, index=True)
    claim_number = Column(String(50), unique=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    provider_name = Column(String(100), nullable=False)
    policy_number = Column(String(100), nullable=False)
    claim_amount = Column(Float, nullable=False)
    approved_amount = Column(Float, default=0.0)
    status = Column(String(50), default="Submitted") # Submitted, In-Review, Approved, Rejected, Settled
    rejection_reason = Column(String(255), nullable=True)
    submitted_at = Column(DateTime, default=utcnow)
    
    invoice = relationship("Invoice", back_populates="insurance_claims")

class FollowUp(Base):
    __tablename__ = "follow_ups"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    follow_up_date = Column(Date, nullable=False)
    reason = Column(String(255))
    instructions = Column(Text)
    status = Column(String(50), default="Scheduled") # Scheduled, Completed, Missed
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    
    encounter = relationship("Encounter", back_populates="follow_up")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String(50), default="In-App") # In-App, SMS, Email, WhatsApp
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=utcnow)

class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    rating_doctor = Column(Integer, default=5) # 1-5
    rating_waiting = Column(Integer, default=4) # 1-5
    rating_facility = Column(Integer, default=5) # 1-5
    comments = Column(Text)
    sentiment = Column(String(50), default="Positive") # Positive, Neutral, Negative
    submitted_at = Column(DateTime, default=utcnow)
    
    patient = relationship("Patient", back_populates="feedback")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(150))
    user_role = Column(String(50))
    action = Column(String(100), nullable=False) # e.g. VIEW_EHR, ISSUE_PRESCRIPTION, DISPENSE_MEDICINE, CHECK_IN
    resource_type = Column(String(100), nullable=False) # Patient, Prescription, Queue, Invoice
    resource_id = Column(String(100))
    ip_address = Column(String(50))
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=utcnow)
    
    user = relationship("User", back_populates="audit_logs")

class AIPredictionLog(Base):
    __tablename__ = "ai_predictions"
    id = Column(Integer, primary_key=True, index=True)
    prediction_type = Column(String(50), nullable=False) # wait_time, noshow, sentiment, cds_interaction
    input_features = Column(JSON)
    output_result = Column(JSON)
    confidence = Column(Float, nullable=True)
    actual_outcome = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow)
