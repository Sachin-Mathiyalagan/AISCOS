# AISCOS — Product Requirements Document (PRD)

## 1. Product Identification
- **Product Name**: AISCOS (AI-Powered Smart Clinic & Hospital Operating System)
- **Tagline**: Intelligent Patient Flow, Healthcare Automation, Electronic Health Records, and Clinical Decision Support
- **Target Deployment**: Modern Multi-Specialty Clinics, Daycare Healthcare Facilities, and Multi-Branch Hospital Outpatient Departments.

---

## 2. Problem Statement
Traditional healthcare facilities face severe operational bottlenecks:
1. **Inefficient Paper & Static Token Queues**: Standard FIFO causes critical/emergency cases to wait, leads to unpredictable waiting times (30–90 min variances), and frustrates patients.
2. **Disconnected Information Silos**: Disparate systems for registration, clinical consultation, lab orders, pharmacy dispensing, and billing result in transcription errors, missed drug interactions, and delayed care.
3. **Doctor Burnout & Inefficient Documentation**: Unstructured notes consume valuable doctor time without providing real-time clinical decision support (CDS) or drug-allergy warnings.
4. **Lack of Predictive Operational Intelligence**: Clinic administrators cannot forecast peak-hour surges, patient no-show probabilities, or doctor utilization effectively.

---

## 3. Goals and Objectives
1. **Eliminate Static Queues**: Implement a Dynamic Weighted Hybrid Priority Queue with AI-driven wait-time forecasting.
2. **Unified Digital Patient Journey**: Connect Patient Discovery -> Booking -> QR/Walk-in Check-in -> Triage -> Doctor Consultation -> Prescription -> Lab -> Pharmacy -> Billing -> Follow-up.
3. **Clinical Safety & Decision Support**: Provide automated drug-drug interaction checking, allergy alerts, guideline RAG retrieval, and speech-to-clinical note drafting with mandatory clinician approval.
4. **Role-Based Operational Workspaces**: Dedicated, highly responsive UI dashboards for 8+ roles: Super Admin, Clinic Admin, Doctor, Nurse, Receptionist, Pharmacist, Lab Tech, Billing Staff, and Patient.
5. **Academic Research Benchmark**: Deliver an empirical evaluation module comparing Traditional FIFO vs. Dynamic Priority Queue vs. AI-Optimized Scheduling.

---

## 4. Key Stakeholders & Role Matrix
| Role | Primary Functions | Key Metrics Tracked |
|---|---|---|
| **Patient** | Online booking, QR check-in, live token tracking, view prescriptions/labs, make payments | Waiting time, care satisfaction |
| **Receptionist** | Walk-in intake, schedule management, token generation, emergency escalation | Intake throughput, queue check-in latency |
| **Nurse** | Vitals recording, triage classification (Emergency/Urgent/Routine), intake notes | Triage accuracy, vitals completion rate |
| **Doctor** | Queue view, longitudinal EHR, SOAP consultation notes, CDS review, digital prescriptions | Average consultation time, doctor utilization |
| **Pharmacist** | Prescription verification, FEFO batch dispensing, inventory threshold monitoring | Dispensing speed, stockout & expiry rate |
| **Lab Technician**| Sample collection/tracking (Barcode/QR), result entry, abnormal flag alerts | Test turnaround time (TAT) |
| **Billing Staff** | Invoicing (consultation + lab + pharmacy), discount/tax calculations, insurance claims | Days in A/R, collection rate |
| **Clinic / Super Admin** | Doctor schedules, department management, multi-branch analytics, audit logs | Overall clinic throughput, revenue, no-show rate |

---

## 5. Functional Scope by Module
- **Module 1**: Authentication, JWT session tracking, Bcrypt/Argon2 hashing, RBAC.
- **Module 2**: Patient Profile, QR identification, duplicate detection, longitudinal EHR timeline.
- **Module 3**: Appointment Scheduling, slot availability, double-booking prevention.
- **Module 4 & 5**: Smart Check-in & Hybrid Multi-Priority Digital Queue.
- **Module 6 & 7**: AI Waiting-Time Regressor & Queue Constraint Optimizer.
- **Module 8 & 9**: Longitudinal EHR & Nurse Triage (Emergency/Urgent/Semi-Urgent/Routine).
- **Module 10 & 11**: Doctor Consultation Console & Structured Digital Prescriptions.
- **Module 12, 13 & 14**: AI Clinical Notes, CDS Drug Interactions, Guidelines RAG.
- **Module 15 & 16**: Diagnostic Lab Management & FEFO Pharmacy Dispensing.
- **Module 17 & 18**: Inventory Management & Itemized Invoicing/Payments.
- **Module 19 & 20**: Insurance Claims Abstraction & Automated Follow-Up Reminders.
- **Module 21 & 22**: Centralized Notification Engine & Patient Administrative Chatbot.
- **Module 23**: Telemedicine WebRTC Infrastructure Readiness.
- **Module 24, 25 & 26**: Executive Analytics Dashboard, AI No-Show & Volume Forecasting, Sentiment Feedback.
- **Module 27, 28 & 29**: Secure Document Vault, Global Universal Search, Real-Time WebSockets.
- **Module 30 & 31**: Multi-Branch Tenancy Architecture & Cryptographic Immutable Audit Logging.
- **Module 32, 33 & 34**: Security Compliance, Privacy & HL7 FHIR Interoperability Standard.
