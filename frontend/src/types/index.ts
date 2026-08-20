export type UserRole = 
  | 'super_admin'
  | 'clinic_admin'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'pharmacist'
  | 'lab_technician'
  | 'billing_staff'
  | 'patient';

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  clinic_id?: number;
  is_active: boolean;
  avatar_url?: string;
  doctor_profile?: {
    id: number;
    specialty: string;
    license_number: string;
    room_number?: string;
    consultation_fee: number;
  };
  patient_profile?: {
    id: number;
    mrn: string;
    blood_group?: string;
    allergies?: string;
    chronic_conditions?: string;
    qr_code_token?: string;
  };
}

export interface Patient {
  id: number;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  blood_group?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  qr_code_token?: string;
  is_senior?: boolean;
  created_at: string;
}

export interface Doctor {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  specialty: string;
  qualification?: string;
  room_number?: string;
  consultation_fee: number;
  avg_consultation_time: number;
  is_available?: boolean;
  department_name?: string;
}

export interface Appointment {
  id: number;
  appointment_code: string;
  doctor_id: number;
  patient_id: number;
  doctor_name: string;
  patient_name: string;
  patient_mrn?: string;
  doctor_specialty: string;
  appointment_date: string;
  slot_time: string;
  appointment_type: string;
  status: string;
  chief_complaint?: string;
  is_walk_in: boolean;
  created_at: string;
}

export interface AvailableSlotsData {
  doctor_id: number;
  doctor_name: string;
  specialty: string;
  date: string;
  day_of_week: number;
  slot_duration_mins: number;
  available_slots: string[];
  booked_slots: string[];
}

export interface QueueEntry {
  id: number;
  token_number: string;
  doctor_id: number;
  patient_id: number;
  appointment_id?: number;
  patient_name: string;
  patient_mrn: string;
  patient_gender: string;
  doctor_name: string;
  doctor_specialty: string;
  room_number?: string;
  status: 'Waiting' | 'Called' | 'In-Consultation' | 'Completed' | 'Skipped' | 'Transferred' | 'Cancelled';
  priority_score: number;
  is_emergency: boolean;
  triage_level: 1 | 2 | 3 | 4;
  queue_position: number;
  estimated_wait_minutes: number;
  confidence_interval_min: number;
  confidence_interval_max: number;
  check_in_time: string;
  called_time?: string;
  consultation_start_time?: string;
  consultation_end_time?: string;
}

export interface QueueSummary {
  total_waiting: number;
  total_called: number;
  total_in_consultation: number;
  total_completed_today: number;
  total_queue_today: number;
  avg_wait_minutes: number;
}

export interface Encounter {
  id: number;
  encounter_code: string;
  clinic_id: number;
  doctor_id: number;
  patient_id: number;
  appointment_id?: number;
  queue_entry_id?: number;
  doctor_name?: string;
  patient_name?: string;
  patient_mrn?: string;
  encounter_type: string;
  chief_complaint?: string;
  examination_notes?: string;
  diagnosis_code?: string;
  diagnosis_title?: string;
  treatment_plan?: string;
  doctor_notes?: string;
  status: string;
  start_time: string;
  end_time?: string;
  vitals?: Vitals;
  clinical_note?: ClinicalNote;
  prescription?: any;
  lab_orders?: any[];
}

export interface ClinicalNote {
  id?: number;
  encounter_id: number;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  ai_speech_transcript?: string;
  ai_suggested_draft?: string;
  is_signed?: boolean;
  signed_at?: string;
}

export interface Vitals {
  id?: number;
  patient_id: number;
  encounter_id?: number;
  temperature_f?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate_bpm?: number;
  respiratory_rate?: number;
  spo2_percent?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  pain_score?: number;
  triage_level?: number;
  triage_notes?: string;
  recorded_at?: string;
}

export interface PrescriptionItem {
  id?: number;
  medicine_id: number;
  medicine_name?: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration_days: number;
  quantity: number;
  instructions?: string;
  is_dispensed?: boolean;
}

export interface Prescription {
  id: number;
  prescription_code: string;
  encounter_id: number;
  patient_id: number;
  patient_name?: string;
  patient_mrn?: string;
  doctor_id: number;
  doctor_name?: string;
  doctor_specialty?: string;
  notes?: string;
  verification_hash?: string;
  status: string;
  created_at: string;
  items: PrescriptionItem[];
}

export interface LabTest {
  id: number;
  name: string;
  code: string;
  sample_type: string;
  normal_range_min?: number;
  normal_range_max?: number;
  normal_range_text?: string;
  unit?: string;
  price: number;
  turnaround_hours: number;
}

export interface LabOrder {
  id: number;
  order_number: string;
  patient_id: number;
  patient_name: string;
  patient_mrn: string;
  test_name: string;
  test_code?: string;
  sample_type: string;
  sample_barcode?: string;
  urgency: string;
  status: string;
  ordered_at: string;
  has_results: boolean;
  price?: number;
}

export interface MedicineInventory {
  medicine_id: number;
  name: string;
  generic_name: string;
  category: string;
  dosage_form: string;
  strength: string;
  unit_price: number;
  total_stock: number;
  earliest_expiry: string;
  reorder_needed: boolean;
  batches_count: number;
}

export interface InvoiceItem {
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PaymentRecord {
  reference: string;
  method: string;
  amount: number;
  date: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  patient_id: number;
  patient_name: string;
  patient_mrn: string;
  encounter_id?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'Unpaid' | 'Partially-Paid' | 'Paid' | 'Refunded';
  created_at: string;
  items: InvoiceItem[];
  payments: PaymentRecord[];
}

export interface FollowUp {
  id: number;
  patient_id: number;
  doctor_id: number;
  encounter_id?: number;
  doctor_name?: string;
  patient_name?: string;
  follow_up_date: string;
  reason?: string;
  instructions?: string;
  status: string;
  reminder_sent: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  channel: string;
  is_read: boolean;
  sent_at: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  user_email?: string;
  user_role?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  details?: any;
  timestamp: string;
}
