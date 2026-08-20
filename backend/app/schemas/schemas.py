from datetime import datetime, date
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field

# User & Auth Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: str
    clinic_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Patient Schemas
class PatientBase(BaseModel):
    first_name: str
    last_name: str
    dob: date
    gender: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = "None"
    chronic_conditions: Optional[str] = "None"
    current_medications: Optional[str] = "None"
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    is_senior: Optional[bool] = False

class PatientCreate(PatientBase):
    clinic_id: Optional[int] = 1

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    blood_group: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    current_medications: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_policy_number: Optional[str] = None
    is_senior: Optional[bool] = None

class PatientResponse(PatientBase):
    id: int
    clinic_id: Optional[int] = None
    mrn: str
    qr_code_token: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Doctor Schemas
class DoctorResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    specialty: str
    qualification: Optional[str] = None
    room_number: Optional[str] = None
    consultation_fee: float
    avg_consultation_time: int
    is_available: bool
    department_name: Optional[str] = None
    class Config:
        from_attributes = True

# Appointment Schemas
class AppointmentCreate(BaseModel):
    doctor_id: int
    patient_id: int
    appointment_date: date
    slot_time: str
    appointment_type: Optional[str] = "Routine"
    chief_complaint: Optional[str] = None
    is_walk_in: Optional[bool] = False

class AppointmentRescheduleRequest(BaseModel):
    appointment_date: date
    slot_time: str
    reason: Optional[str] = "Patient requested reschedule"

class AppointmentCancelRequest(BaseModel):
    reason: Optional[str] = "Patient requested cancellation"

class AvailableSlotsResponse(BaseModel):
    doctor_id: int
    doctor_name: str
    specialty: str
    date: date
    day_of_week: int
    slot_duration_mins: int
    available_slots: List[str]
    booked_slots: List[str]

class AppointmentResponse(BaseModel):
    id: int
    appointment_code: str
    doctor_id: int
    patient_id: int
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    doctor_specialty: Optional[str] = None
    appointment_date: date
    slot_time: str
    appointment_type: str
    status: str
    chief_complaint: Optional[str] = None
    is_walk_in: bool
    created_at: datetime
    class Config:
        from_attributes = True

# Check-in & Queue Schemas
class CheckInRequest(BaseModel):
    patient_id: int
    doctor_id: int
    appointment_id: Optional[int] = None
    is_emergency: Optional[bool] = False
    triage_level: Optional[int] = 4 # 1 to 4
    chief_complaint: Optional[str] = None

class QueueTransferRequest(BaseModel):
    new_doctor_id: int
    reason: Optional[str] = "Department / Doctor transfer"
    triage_level: Optional[int] = None

class EmergencyQueueRequest(BaseModel):
    patient_id: int
    doctor_id: int
    reason: str
    triage_level: int = 1
    chief_complaint: Optional[str] = "Acute Emergency"

class QueueSummaryResponse(BaseModel):
    total_waiting: int
    total_called: int
    total_in_consultation: int
    total_completed_today: int
    total_queue_today: int
    avg_wait_minutes: float

class QueueEntryResponse(BaseModel):
    id: int
    token_number: str
    doctor_id: int
    patient_id: int
    appointment_id: Optional[int] = None
    patient_name: str
    patient_mrn: str
    patient_gender: str
    doctor_name: str
    doctor_specialty: str
    room_number: Optional[str] = None
    status: str
    priority_score: float
    is_emergency: bool
    triage_level: int
    queue_position: int
    estimated_wait_minutes: int
    confidence_interval_min: int
    confidence_interval_max: int
    check_in_time: datetime
    called_time: Optional[datetime] = None
    consultation_start_time: Optional[datetime] = None
    consultation_end_time: Optional[datetime] = None
    class Config:
        from_attributes = True

# Vitals & Triage Schemas
class VitalsCreate(BaseModel):
    patient_id: int
    encounter_id: Optional[int] = None
    temperature_f: Optional[float] = 98.6
    systolic_bp: Optional[int] = 120
    diastolic_bp: Optional[int] = 80
    heart_rate_bpm: Optional[int] = 75
    respiratory_rate: Optional[int] = 16
    spo2_percent: Optional[int] = 98
    weight_kg: Optional[float] = 70.0
    height_cm: Optional[float] = 170.0
    pain_score: Optional[int] = 0
    triage_level: Optional[int] = 4
    triage_notes: Optional[str] = None

class VitalsResponse(VitalsCreate):
    id: int
    bmi: Optional[float] = None
    recorded_at: datetime
    class Config:
        from_attributes = True

# Clinical Encounter Schemas
class EncounterCreate(BaseModel):
    doctor_id: int
    patient_id: int
    appointment_id: Optional[int] = None
    queue_entry_id: Optional[int] = None
    encounter_type: Optional[str] = "Outpatient"
    chief_complaint: Optional[str] = None

class EncounterUpdate(BaseModel):
    chief_complaint: Optional[str] = None
    examination_notes: Optional[str] = None
    diagnosis_code: Optional[str] = None
    diagnosis_title: Optional[str] = None
    treatment_plan: Optional[str] = None
    doctor_notes: Optional[str] = None
    status: Optional[str] = None

class EncounterResponse(BaseModel):
    id: int
    encounter_code: str
    clinic_id: int
    doctor_id: int
    patient_id: int
    appointment_id: Optional[int] = None
    queue_entry_id: Optional[int] = None
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    encounter_type: str
    chief_complaint: Optional[str] = None
    examination_notes: Optional[str] = None
    diagnosis_code: Optional[str] = None
    diagnosis_title: Optional[str] = None
    treatment_plan: Optional[str] = None
    doctor_notes: Optional[str] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    vitals: Optional[dict] = None
    clinical_note: Optional[dict] = None
    prescription: Optional[dict] = None
    lab_orders: Optional[List[dict]] = None
    class Config:
        from_attributes = True

class ClinicalNoteCreate(BaseModel):
    encounter_id: int
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    ai_speech_transcript: Optional[str] = None
    ai_suggested_draft: Optional[str] = None
    is_signed: Optional[bool] = False

# Prescription Schemas
class PrescriptionItemCreate(BaseModel):
    medicine_id: int
    medicine_name: Optional[str] = None
    dosage: str
    frequency: str
    route: Optional[str] = "Oral"
    duration_days: int = 5
    quantity: int = 10
    instructions: Optional[str] = "After meals"

class PrescriptionCreate(BaseModel):
    encounter_id: int
    patient_id: int
    doctor_id: int
    notes: Optional[str] = None
    items: List[PrescriptionItemCreate]

class PrescriptionResponse(BaseModel):
    id: int
    prescription_code: str
    encounter_id: int
    patient_id: int
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    doctor_id: int
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    notes: Optional[str] = None
    verification_hash: Optional[str] = None
    status: str
    created_at: datetime
    items: List[dict]
    class Config:
        from_attributes = True

# Lab Schemas
class LabOrderCreate(BaseModel):
    encounter_id: int
    patient_id: int
    doctor_id: int
    test_id: int
    urgency: Optional[str] = "Routine"
    clinical_indication: Optional[str] = None

class LabResultCreate(BaseModel):
    lab_order_id: int
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    is_abnormal: Optional[bool] = False
    flags: Optional[str] = None
    technician_notes: Optional[str] = None

# Pharmacy & Inventory Schemas
class MedicineResponse(BaseModel):
    id: int
    name: str
    generic_name: str
    category: Optional[str] = None
    dosage_form: Optional[str] = None
    strength: Optional[str] = None
    unit_price: float
    total_stock: Optional[int] = 0
    class Config:
        from_attributes = True

class DispenseRequest(BaseModel):
    prescription_id: int
    item_ids: Optional[List[int]] = None # If None, dispenses all items

class InventoryStockCreate(BaseModel):
    medicine_id: int
    batch_number: str
    expiry_date: date
    quantity_in_stock: int
    reorder_level: Optional[int] = 20
    cost_price: Optional[float] = 5.0
    unit_selling_price: Optional[float] = 10.0
    supplier_name: Optional[str] = "Apex Healthcare Global"

# Billing & Invoicing Schemas
class InvoiceItemCreate(BaseModel):
    item_type: str # Consultation, Pharmacy, Lab, Procedure
    description: str
    quantity: int = 1
    unit_price: float

class InvoiceCreate(BaseModel):
    patient_id: int
    encounter_id: Optional[int] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    items: List[InvoiceItemCreate]

class PaymentCreate(BaseModel):
    invoice_id: int
    payment_method: str = "Cash" # Cash, Card, UPI, Insurance, TEST_PAYMENT
    amount: float
    transaction_id: Optional[str] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    patient_id: int
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    encounter_id: Optional[int] = None
    subtotal: float
    discount: float
    tax: float
    total_amount: float
    paid_amount: float
    payment_status: str
    created_at: datetime
    items: List[dict]
    payments: List[dict]
    class Config:
        from_attributes = True

# Follow-Up Schemas
class FollowUpCreate(BaseModel):
    patient_id: int
    doctor_id: int
    encounter_id: Optional[int] = None
    follow_up_date: date
    reason: Optional[str] = "Routine clinical review"
    instructions: Optional[str] = "Follow medication instructions"

class FollowUpResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    encounter_id: Optional[int] = None
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    follow_up_date: date
    reason: Optional[str] = None
    instructions: Optional[str] = None
    status: str
    reminder_sent: bool
    created_at: datetime
    class Config:
        from_attributes = True

# AI & CDS Schemas
class CDSDrugCheckRequest(BaseModel):
    patient_id: int
    new_medicines: List[str]

class CDSDrugCheckResponse(BaseModel):
    has_critical_interaction: bool
    has_allergy_warning: bool
    alerts: List[Dict[str, Any]]
    recommendations: List[str]

class ClinicalRAGRequest(BaseModel):
    query: str
    context: Optional[str] = None

class AIChatRequest(BaseModel):
    message: str
    patient_id: Optional[int] = None
    role: Optional[str] = "patient"

# Research Simulation Request
class ResearchSimRequest(BaseModel):
    num_patients: int = 100
    emergency_rate: float = 0.05
    urgent_rate: float = 0.20
    appointment_rate: float = 0.45
    walkin_rate: float = 0.30
