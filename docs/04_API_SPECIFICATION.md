# AISCOS — API Specification & Endpoint Documentation

## 1. API Architecture Overview
- **Protocol**: HTTP/1.1 & HTTP/2 with JSON payloads, WebSocket for real-time streaming (`/api/v1/ws/{client_id}`).
- **Authentication**: Bearer JWT (JSON Web Tokens) with token rotation.
- **Base Prefix**: `/api/v1`
- **Error Format**:
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Encounter with ID 104 does not exist.",
    "details": null
  },
  "timestamp": "2026-08-18T17:00:00Z"
}
```

---

## 2. Core API Endpoints

### 2.1 Authentication & Profile (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new patient or staff user.
- `POST /api/v1/auth/login` — Authenticate credentials, return access & refresh JWT tokens + user profile.
- `POST /api/v1/auth/refresh` — Issue fresh access token using valid refresh token.
- `GET  /api/v1/auth/me` — Return current authenticated user identity and permissions.

### 2.2 Patient Management (`/api/v1/patients`)
- `GET  /api/v1/patients` — List/search patients with pagination, search query, filter by MRN/phone.
- `POST /api/v1/patients` — Create complete patient demographic & clinical profile.
- `GET  /api/v1/patients/{id}` — Get single patient details.
- `PUT  /api/v1/patients/{id}` — Update patient profile (allergies, contact, insurance).
- `GET  /api/v1/patients/{id}/records` — Retrieve unified longitudinal EHR timeline.

### 2.3 Appointments (`/api/v1/appointments`)
- `GET  /api/v1/appointments` — Filter appointments by date, doctor, patient, status.
- `POST /api/v1/appointments` — Book new appointment with slot collision detection.
- `PUT  /api/v1/appointments/{id}/reschedule` — Move appointment slot.
- `PUT  /api/v1/appointments/{id}/cancel` — Cancel appointment with reason.
- `GET  /api/v1/appointments/slots` — Get available time slots for doctor & date.

### 2.4 Smart Check-In & Hybrid Queue (`/api/v1/queue`)
- `POST /api/v1/queue/check-in` — Check-in patient (QR, reception, walk-in), generate dynamic token & calculate priority score.
- `GET  /api/v1/queue/doctor/{doctor_id}` — Get real-time ordered waiting list for specific doctor.
- `GET  /api/v1/queue/display` — Public monitor queue board view with current, next, and estimated waits.
- `POST /api/v1/queue/{id}/call` — Doctor calls next patient into consultation room.
- `POST /api/v1/queue/{id}/complete` — Doctor marks consultation complete, triggering downstream billing/pharmacy/lab events.
- `POST /api/v1/queue/{id}/transfer` — Transfer patient to another doctor/department.
- `POST /api/v1/queue/{id}/emergency-insert` — Priority override for acute emergency cases.

### 2.5 Clinical Consultation, EHR & CDS (`/api/v1/clinical`)
- `POST /api/v1/clinical/encounters` — Initiate encounter session.
- `POST /api/v1/clinical/vitals` — Nurse/Doctor record patient vitals & triage level.
- `POST /api/v1/clinical/notes` — Save structured SOAP clinical note.
- `POST /api/v1/clinical/cds/drug-interactions` — Validate selected medications against current regimen and allergies.
- `POST /api/v1/clinical/cds/guidelines-rag` — Query evidence-based medical knowledge vector index for treatment protocols.
- `POST /api/v1/clinical/voice-transcribe` — Process dictation audio / text transcript to draft structured SOAP notes.

### 2.6 Digital Prescriptions (`/api/v1/prescriptions`)
- `POST /api/v1/prescriptions` — Doctor creates and electronically signs structured prescription.
- `GET  /api/v1/prescriptions/{id}` — Retrieve prescription details with verification QR payload.
- `GET  /api/v1/prescriptions/patient/{patient_id}` — Retrieve patient prescription history.

### 2.7 Laboratory Workflows (`/api/v1/lab`)
- `GET  /api/v1/lab/tests` — Fetch test directory & reference ranges.
- `POST /api/v1/lab/orders` — Create laboratory test request.
- `GET  /api/v1/lab/worklist` — Lab technician active sample collection & processing queue.
- `POST /api/v1/lab/results` — Record test values, highlight abnormal flags, verify and generate report.

### 2.8 Pharmacy & FEFO Inventory (`/api/v1/pharmacy`)
- `GET  /api/v1/pharmacy/inventory` — Query medicines, stock levels, batch expiries, and reorder alerts.
- `POST /api/v1/pharmacy/dispense` — Dispense prescription medications using First-Expiry-First-Out (FEFO) batch deduction.
- `POST /api/v1/pharmacy/batches` — Add new supplier stock batch with expiry and unit cost.

### 2.9 Billing, Invoicing & Insurance (`/api/v1/billing`)
- `GET  /api/v1/billing/invoices` — List invoices by status, date range, patient.
- `POST /api/v1/billing/invoices/generate` — Auto-consolidate consultation, lab, and pharmacy charges into itemized invoice.
- `POST /api/v1/billing/payments` — Record payment transaction (Cash, Card, UPI, Insurance).
- `POST /api/v1/billing/insurance/claims` — Submit and track insurance claim lifecycle.

### 2.10 AI Analytics & Predictive Services (`/api/v1/ai`)
- `POST /api/v1/ai/predict-wait-time` — Infer waiting time using Gradient Boosting ML model.
- `POST /api/v1/ai/predict-noshow` — Infer no-show probability for an appointment.
- `POST /api/v1/ai/chat` — Conversational administrative AI agent for patient inquiries and clinic FAQs.
- `GET  /api/v1/ai/research-benchmark` — Execute comparative simulation between FIFO, Dynamic Priority, and AI Queue.

### 2.11 Notifications, Telemedicine & Audit
- `GET  /api/v1/notifications` — Retrieve user notifications.
- `POST /api/v1/telemedicine/sessions` — Initiate WebRTC consultation room.
- `GET  /api/v1/audit/logs` — Query immutable audit logs with role and date filters.
- `GET  /api/v1/fhir/Patient/{id}` — HL7 FHIR R4 Patient resource representation.
