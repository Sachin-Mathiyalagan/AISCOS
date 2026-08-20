import { 
  User, Patient, Doctor, Appointment, AvailableSlotsData,
  QueueEntry, QueueSummary, Encounter, Vitals, Prescription,
  LabTest, LabOrder, MedicineInventory, Invoice, FollowUp,
  AuditLogItem, NotificationItem 
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '') + '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('aiscos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function handleResponse<T>(res: Response, fallbackError = 'API request failed'): Promise<T> {
  if (!res.ok) {
    let errMsg = fallbackError;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch {
      errMsg = `${res.status} ${res.statusText}`;
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res, 'Login failed');
  },

  async getCurrentUser(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to fetch current user profile');
  },

  async getDemoUsers(): Promise<Array<{ id: number; full_name: string; email: string; role: string; role_title: string }>> {
    const res = await fetch(`${API_BASE}/auth/demo-users`);
    return handleResponse(res, 'Failed to fetch demo users');
  },

  // Patients
  async getPatients(search?: string): Promise<Patient[]> {
    const url = search ? `${API_BASE}/patients?search=${encodeURIComponent(search)}` : `${API_BASE}/patients`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patients');
  },

  async getPatient(patientId: number): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patient profile');
  },

  async getPatientTimeline(patientId: number): Promise<{ patient: Patient; timeline: any[] }> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/records`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch longitudinal EHR records');
  },

  async createPatient(patientData: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(patientData)
    });
    return handleResponse(res, 'Failed to register patient');
  },

  // Doctors & Appointments
  async getDoctors(): Promise<Doctor[]> {
    const res = await fetch(`${API_BASE}/appointments/doctors`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch doctors list');
  },

  async getAppointments(doctorId?: number, patientId?: number, date?: string, status?: string): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (doctorId) params.append('doctor_id', doctorId.toString());
    if (patientId) params.append('patient_id', patientId.toString());
    if (date) params.append('appointment_date', date);
    if (status) params.append('status_filter', status);
    
    const url = `${API_BASE}/appointments${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch appointments');
  },

  async getAppointment(appointmentId: number): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch appointment details');
  },

  async getAvailableSlots(doctorId: number, appointmentDate: string): Promise<AvailableSlotsData> {
    const res = await fetch(`${API_BASE}/appointments/slots?doctor_id=${doctorId}&appointment_date=${appointmentDate}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to calculate available schedule slots');
  },

  async bookAppointment(apptData: {
    doctor_id: number;
    patient_id: number;
    appointment_date: string;
    slot_time: string;
    appointment_type?: string;
    chief_complaint?: string;
    is_walk_in?: boolean;
  }): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(apptData)
    });
    return handleResponse(res, 'Failed to book appointment slot');
  },

  async rescheduleAppointment(appointmentId: number, appointmentDate: string, slotTime: string, reason?: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/reschedule`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ appointment_date: appointmentDate, slot_time: slotTime, reason })
    });
    return handleResponse(res, 'Failed to reschedule appointment');
  },

  async cancelAppointment(appointmentId: number, reason?: string): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    return handleResponse(res, 'Failed to cancel appointment');
  },

  // Smart Queue & Digital Tokens
  async checkIn(checkInData: {
    patient_id: number;
    doctor_id: number;
    appointment_id?: number;
    is_emergency?: boolean;
    triage_level?: number;
    chief_complaint?: string;
  }): Promise<QueueEntry> {
    const res = await fetch(`${API_BASE}/queue/check-in`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(checkInData)
    });
    return handleResponse(res, 'Check-in failed');
  },

  async getDoctorQueue(doctorId: number): Promise<QueueEntry[]> {
    const res = await fetch(`${API_BASE}/queue/doctor/${doctorId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch doctor queue');
  },

  async getPatientActiveQueue(patientId: number): Promise<{ has_active_token: boolean; active_entry: any }> {
    const res = await fetch(`${API_BASE}/queue/patient/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patient queue status');
  },

  async getQueueSummary(): Promise<QueueSummary> {
    const res = await fetch(`${API_BASE}/queue/summary`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch queue summary metrics');
  },

  async getPublicDisplayQueue(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/queue/public-display`);
    return handleResponse(res, 'Failed to fetch public display board');
  },

  async callNextPatient(queueId: number): Promise<{ message: string; entry_id: number; token_number: string; status: string }> {
    const res = await fetch(`${API_BASE}/queue/${queueId}/call`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to call patient');
  },

  async startConsultation(queueId: number): Promise<{ message: string; entry_id: number; token_number: string; encounter_id: number; encounter_code: string; status: string }> {
    const res = await fetch(`${API_BASE}/queue/${queueId}/start`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to start consultation');
  },

  async completeConsultation(queueId: number): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/queue/${queueId}/complete`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to complete consultation');
  },

  async transferQueueEntry(queueId: number, newDoctorId: number, reason?: string, triageLevel?: number): Promise<QueueEntry> {
    const res = await fetch(`${API_BASE}/queue/${queueId}/transfer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_doctor_id: newDoctorId, reason, triage_level: triageLevel })
    });
    return handleResponse(res, 'Failed to transfer queue entry');
  },

  async emergencyQueueInsert(patientId: number, doctorId: number, reason: string): Promise<QueueEntry> {
    const res = await fetch(`${API_BASE}/queue/emergency-insert`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, reason, triage_level: 1 })
    });
    return handleResponse(res, 'Failed to insert emergency patient');
  },

  // Clinical Encounters & CDS
  async createEncounter(data: {
    doctor_id: number;
    patient_id: number;
    appointment_id?: number;
    queue_entry_id?: number;
    chief_complaint?: string;
  }): Promise<Encounter> {
    const res = await fetch(`${API_BASE}/clinical/encounters`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to initiate clinical encounter');
  },

  async getEncounter(encounterId: number): Promise<Encounter> {
    const res = await fetch(`${API_BASE}/clinical/encounters/${encounterId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch encounter details');
  },

  async updateEncounter(encounterId: number, data: {
    chief_complaint?: string;
    examination_notes?: string;
    diagnosis_code?: string;
    diagnosis_title?: string;
    treatment_plan?: string;
    doctor_notes?: string;
  }): Promise<Encounter> {
    const res = await fetch(`${API_BASE}/clinical/encounters/${encounterId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to update encounter details');
  },

  async completeEncounter(encounterId: number): Promise<{ message: string; encounter_id: number; status: string; invoice_number: string; total_billed: number }> {
    const res = await fetch(`${API_BASE}/clinical/encounters/${encounterId}/complete`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to finalize clinical encounter');
  },

  async recordVitals(vitalsData: Vitals): Promise<Vitals> {
    const res = await fetch(`${API_BASE}/clinical/vitals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(vitalsData)
    });
    return handleResponse(res, 'Failed to record vitals telemetry');
  },

  async saveClinicalNotes(noteData: {
    encounter_id: number;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    ai_speech_transcript?: string;
    is_signed?: boolean;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/clinical/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(noteData)
    });
    return handleResponse(res, 'Failed to save clinical notes');
  },

  async checkDrugInteractions(patientId: number, newMedicines: string[]): Promise<{
    has_critical_interaction: boolean;
    has_allergy_warning: boolean;
    alerts: Array<{ drug_a: string; drug_b?: string; severity: string; description?: string; message?: string }>;
    recommendations: string[];
  }> {
    const res = await fetch(`${API_BASE}/clinical/cds/check-interactions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ patient_id: patientId, new_medicines: newMedicines })
    });
    return handleResponse(res, 'CDS drug check failed');
  },

  async queryGuidelinesRAG(query: string): Promise<{
    query: string;
    evidence_sources: Array<{ guideline: string; summary?: string; text?: string }>;
    disclaimer: string;
  }> {
    const res = await fetch(`${API_BASE}/clinical/cds/guidelines-rag`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query })
    });
    return handleResponse(res, 'Clinical guidelines query failed');
  },

  async speechToSOAP(transcript: string): Promise<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }> {
    const res = await fetch(`${API_BASE}/clinical/speech-to-soap`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript })
    });
    return handleResponse(res, 'Voice-to-SOAP transcription failed');
  },

  // Structured Prescriptions & PDF
  async createPrescription(rxData: {
    encounter_id: number;
    patient_id: number;
    doctor_id: number;
    notes?: string;
    items: Array<{
      medicine_id: number;
      dosage: string;
      frequency: string;
      route?: string;
      duration_days: number;
      quantity: number;
      instructions?: string;
    }>;
  }): Promise<Prescription> {
    const res = await fetch(`${API_BASE}/prescriptions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(rxData)
    });
    return handleResponse(res, 'Failed to issue digital prescription');
  },

  async getPrescription(prescriptionId: number): Promise<Prescription> {
    const res = await fetch(`${API_BASE}/prescriptions/${prescriptionId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch prescription details');
  },

  async getPatientPrescriptions(patientId: number): Promise<Prescription[]> {
    const res = await fetch(`${API_BASE}/prescriptions/patient/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patient prescriptions');
  },

  getPrescriptionPdfUrl(prescriptionId: number): string {
    return `${API_BASE}/prescriptions/${prescriptionId}/pdf?print=true`;
  },

  // Laboratory Diagnostics
  async getLabTests(): Promise<LabTest[]> {
    const res = await fetch(`${API_BASE}/lab/tests`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch lab tests directory');
  },

  async orderLabTest(orderData: {
    encounter_id: number;
    patient_id: number;
    doctor_id: number;
    test_id: number;
    urgency?: string;
    clinical_indication?: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/lab/orders`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(orderData)
    });
    return handleResponse(res, 'Failed to order lab diagnostic test');
  },

  async getLabWorklist(): Promise<LabOrder[]> {
    const res = await fetch(`${API_BASE}/lab/worklist`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch lab worklist');
  },

  async getLabWorklistCount(): Promise<{ pending_count: number }> {
    const res = await fetch(`${API_BASE}/lab/worklist/count`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch lab pending count');
  },

  async collectLabSample(orderId: number) {
    const res = await fetch(`${API_BASE}/lab/orders/${orderId}/collect-sample`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to record specimen collection');
  },

  async recordLabResult(resultData: {
    lab_order_id: number;
    numeric_value?: number;
    text_value?: string;
    is_abnormal?: boolean;
    flags?: string;
    technician_notes?: string;
  }) {
    const res = await fetch(`${API_BASE}/lab/results`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(resultData)
    });
    return handleResponse(res, 'Failed to record and verify lab result');
  },

  async getPatientLabReports(patientId: number): Promise<any[]> {
    const res = await fetch(`${API_BASE}/lab/patient/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patient lab reports');
  },

  // Pharmacy & FEFO Inventory
  async getPharmacyInventory(): Promise<MedicineInventory[]> {
    const res = await fetch(`${API_BASE}/pharmacy/inventory`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch pharmacy inventory');
  },

  async getPendingPrescriptions(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/pharmacy/prescriptions/pending`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch pending prescriptions');
  },

  async getPendingPrescriptionsCount(): Promise<{ pending_count: number }> {
    const res = await fetch(`${API_BASE}/pharmacy/prescriptions/pending/count`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch pending prescriptions count');
  },

  async dispensePrescription(prescriptionId: number, itemIds?: number[]) {
    const res = await fetch(`${API_BASE}/pharmacy/dispense`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ prescription_id: prescriptionId, item_ids: itemIds })
    });
    return handleResponse(res, 'Dispense failed');
  },

  async addInventoryStock(stockData: {
    medicine_id: number;
    batch_number: string;
    expiry_date: string;
    quantity_in_stock: number;
    cost_price?: number;
    unit_selling_price?: number;
    supplier_name?: string;
  }) {
    const res = await fetch(`${API_BASE}/pharmacy/inventory/stock`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(stockData)
    });
    return handleResponse(res, 'Failed to add inventory stock batch');
  },

  // Billing & Invoicing
  async getInvoices(patientId?: number, statusFilter?: string): Promise<Invoice[]> {
    const params = new URLSearchParams();
    if (patientId) params.append('patient_id', patientId.toString());
    if (statusFilter) params.append('status_filter', statusFilter);
    const url = `${API_BASE}/billing/invoices${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch invoices');
  },

  async getInvoice(invoiceId: number): Promise<Invoice> {
    const res = await fetch(`${API_BASE}/billing/invoices/${invoiceId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch invoice details');
  },

  async generateEncounterInvoice(encounterId: number) {
    const res = await fetch(`${API_BASE}/billing/generate/${encounterId}`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to generate encounter invoice');
  },

  async recordPayment(invoiceId: number, amount: number, method: string, notes?: string) {
    const res = await fetch(`${API_BASE}/billing/payments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ invoice_id: invoiceId, amount, payment_method: method, notes })
    });
    return handleResponse(res, 'Failed to record payment');
  },

  // Follow-ups
  async createFollowUp(data: {
    patient_id: number;
    doctor_id: number;
    encounter_id?: number;
    follow_up_date: string;
    reason?: string;
    instructions?: string;
  }): Promise<FollowUp> {
    const res = await fetch(`${API_BASE}/followups`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return handleResponse(res, 'Failed to schedule follow-up');
  },

  async getPatientFollowUps(patientId: number): Promise<FollowUp[]> {
    const res = await fetch(`${API_BASE}/followups/patient/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch patient follow-ups');
  },

  async getDoctorFollowUps(doctorId: number): Promise<FollowUp[]> {
    const res = await fetch(`${API_BASE}/followups/doctor/${doctorId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch doctor follow-ups');
  },

  // Analytics & Research Simulation
  async getAnalyticsDashboard(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/dashboard`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch analytics dashboard data');
  },

  async runResearchBenchmark(numPatients: number = 150) {
    const res = await fetch(`${API_BASE}/analytics/research-benchmark?num_patients=${numPatients}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to run research simulation benchmark');
  },

  // AI Assistant Chat & Models
  async sendChatMessage(message: string): Promise<{
    reply: string;
    is_emergency: boolean;
    suggested_specialty?: string;
    action_recommendations?: string[];
  }> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message })
    });
    return handleResponse(res, 'Failed to send message to AI chatbot');
  },

  async getModelEvaluationMetrics() {
    const res = await fetch(`${API_BASE}/ai/evaluation-metrics`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch AI model metrics');
  },

  // Audit Logs & Notifications
  async getAuditLogs(action?: string): Promise<AuditLogItem[]> {
    const url = action ? `${API_BASE}/audit/logs?action=${encodeURIComponent(action)}` : `${API_BASE}/audit/logs`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch audit logs');
  },

  async getNotifications(): Promise<NotificationItem[]> {
    const res = await fetch(`${API_BASE}/notifications`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch notifications');
  },

  async markNotificationRead(notifId: number) {
    const res = await fetch(`${API_BASE}/notifications/${notifId}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res, 'Failed to mark notification as read');
  },

  // FHIR Interoperability
  async getFhirPatient(patientId: number) {
    const res = await fetch(`${API_BASE}/fhir/Patient/${patientId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch FHIR Patient resource');
  },

  async getFhirEncounter(encounterId: number) {
    const res = await fetch(`${API_BASE}/fhir/Encounter/${encounterId}`, { headers: getAuthHeaders() });
    return handleResponse(res, 'Failed to fetch FHIR Encounter resource');
  }
};
