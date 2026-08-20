# AISCOS — System Architecture & Diagrams Specification

## 1. System Architecture Overview

```mermaid
graph TD
    subgraph Client_Layer ["Client Presentation Layer (React 18 + TS + Tailwind)"]
        P_UI[Patient Portal]
        D_UI[Doctor Clinical Workspace]
        R_UI[Receptionist & Queue Kiosk]
        N_UI[Nurse Triage Portal]
        PH_UI[Pharmacy Console]
        L_UI[Laboratory Console]
        B_UI[Billing & Finance Console]
        A_UI[Admin & Analytics Dashboard]
    end

    subgraph API_Gateway ["API Gateway & Middleware Layer (FastAPI)"]
        AUTH[JWT / RBAC Security Middleware]
        AUDIT[Audit Interceptor & Access Logger]
        WS_HUB[WebSocket Real-Time Event Hub]
        ROUTERS[RESTful API v1 Routers]
    end

    subgraph Core_Services ["Application Core Services Layer"]
        QUE_SVC[Hybrid Priority Queue Engine]
        EHR_SVC[Clinical Record & Encounter Service]
        RX_SVC[Structured Prescription Engine]
        LAB_SVC[Laboratory Order & Result Service]
        PHARM_SVC[FEFO Pharmacy & Inventory Service]
        BILL_SVC[Automated Billing & Insurance Service]
        NOTIF_SVC[Multi-Channel Notification Dispatcher]
        FHIR_SVC[HL7 FHIR Interoperability Adapter]
    end

    subgraph AI_ML_Subsystem ["AI & Decision Support Subsystem"]
        AI_WAIT[Waiting-Time Regressor - GradientBoosting]
        AI_NOSHOW[No-Show Predictor - RandomForest]
        AI_CDS[Clinical Decision Support & Drug Checker]
        AI_RAG[Evidence Medical Guidelines Vector RAG]
        AI_SPEECH[Speech-to-Clinical Notes Parser]
        AI_SENT[Patient Sentiment & Feedback Classifier]
    end

    subgraph Data_Storage ["Persistence & Cache Layer"]
        DB[(PostgreSQL / SQLite Database)]
        CACHE[(In-Memory / Redis State Cache)]
        DOC_VAULT[(Secure Document Storage)]
    end

    Client_Layer <==>|HTTPS REST & WSS| API_Gateway
    API_Gateway --> Core_Services
    Core_Services <--> AI_ML_Subsystem
    Core_Services <--> Data_Storage
    AI_ML_Subsystem <--> Data_Storage
```

---

## 2. Data Flow Diagrams (DFD)

### 2.1 DFD Level 0 (Context Diagram)

```mermaid
flowchart TD
    Patient((Patient))
    Doctor((Doctor))
    Staff((Clinic Staff & Admin))
    AISCOS[AISCOS System Platform]
    Ext_Lab((External Lab/Imaging))
    Ins_Pay((Payment/Insurance Gateway))

    Patient -->|Bookings, Check-in, Symptoms, Feedback| AISCOS
    AISCOS -->|Tokens, Live ETA, Prescriptions, Reports, Invoices| Patient

    Doctor -->|Consultation notes, CDS queries, Lab/Rx orders| AISCOS
    AISCOS -->|Patient History, Live Queue, CDS Drug Alerts| Doctor

    Staff -->|Vitals, Triage, Sample Results, Dispense, Invoicing| AISCOS
    AISCOS -->|Worklists, Low-Stock Alerts, Financial Metrics| Staff

    AISCOS <-->|Orders & Electronic Results| Ext_Lab
    AISCOS <-->|Payment Authorizations & Claims| Ins_Pay
```

### 2.2 DFD Level 1 (Decomposition)

```mermaid
flowchart TD
    subgraph DFD_Level_1
        P1[1.0 User Authentication & RBAC]
        P2[2.0 Patient & Appointment Mgmt]
        P3[3.0 Smart Check-in & Priority Queue Engine]
        P4[4.0 Doctor Consultation & Clinical CDS]
        P5[5.0 Lab & Pharmacy Fulfillment]
        P6[6.0 Automated Billing & Invoicing]
        P7[7.0 AI Analytics & Wait-Time Engine]

        D1[(Users & Roles)]
        D2[(Patients & Appts)]
        D3[(Queues & Tokens)]
        D4[(Encounters & Prescriptions)]
        D5[(Lab Orders & Inventory)]
        D6[(Invoices & Payments)]
        D7[(Audit & ML Models)]
    end

    P1 <--> D1
    P2 <--> D2
    P3 <--> D3
    P4 <--> D4
    P5 <--> D5
    P6 <--> D6
    P7 <--> D7

    P2 -->|Appointment Event| P3
    P3 -->|Token Called| P4
    P4 -->|Prescription/Lab Order| P5
    P4 -->|Encounter Fee| P6
    P5 -->|Lab & Drug Charges| P6
    P3 <-->|Queue Features & ETA| P7
```

---

## 3. Use Case Diagram

```mermaid
flowchart LR
    subgraph Actors
        PAT[Patient]
        REC[Receptionist]
        NUR[Nurse]
        DOC[Doctor]
        PHARM[Pharmacist]
        TECH[Lab Tech]
        BILL[Billing Staff]
        ADM[Admin]
    end

    subgraph Use_Cases ["AISCOS Use Cases"]
        UC1[Book Appointment]
        UC2[Check-in & Get Digital Token]
        UC3[View Live Queue & Predicted ETA]
        UC4[Triage & Record Vitals]
        UC5[Conduct Consultation & Record SOAP]
        UC6[Review CDS Drug-Drug Alerts]
        UC7[Issue Digital Prescription]
        UC8[Collect Sample & Enter Lab Result]
        UC9[Dispense Medication via FEFO]
        UC10[Generate Invoice & Process Payment]
        UC11[View Operational Analytics & AI Forecasts]
    end

    PAT --> UC1
    PAT --> UC2
    PAT --> UC3
    REC --> UC2
    NUR --> UC4
    DOC --> UC5
    DOC --> UC6
    DOC --> UC7
    TECH --> UC8
    PHARM --> UC9
    BILL --> UC10
    ADM --> UC11
```

---

## 4. Sequence Diagrams

### 4.1 Check-in, Priority Queueing & AI Waiting-Time Update
```mermaid
sequenceDiagram
    autonumber
    actor P as Patient
    actor R as Receptionist / Kiosk
    participant API as AISCOS API & Gateway
    participant QE as Hybrid Queue Engine
    participant ML as AI Wait-Time Regressor
    participant WS as WebSocket Hub
    actor D as Doctor Console

    P->>R: Arrives for Appointment or Walk-in
    R->>API: POST /api/v1/queue/check-in {patient_id, doctor_id, triage_level, is_emergency}
    API->>QE: Calculate Dynamic Priority Score
    QE->>ML: Predict ETA (Queue Length, Doctor Speed, Time, Acuity)
    ML-->>QE: Return ETA (e.g. 18 mins ± 3 min)
    QE->>API: Persist Token (#A-104, Position: 3, Priority: 84)
    API->>WS: Broadcast EVENT: QUEUE_UPDATED
    WS-->>P: Live Token Update (#A-104, ETA: 18m)
    WS-->>D: Updated Waiting Room Queue
    WS-->>R: Refresh Public Display
```

### 4.2 Doctor Consultation, Clinical CDS & Electronic Fulfillment
```mermaid
sequenceDiagram
    autonumber
    actor D as Doctor
    participant API as AISCOS API
    participant CDS as Clinical Decision Support / RAG
    participant EHR as EHR Service
    participant PH as Pharmacy Service
    participant LB as Lab Service
    participant BL as Billing Service

    D->>API: POST /api/v1/queue/{id}/call (Starts Encounter)
    API-->>D: Patient Summary, Vitals & Longitudinal History
    D->>API: POST /api/v1/cds/check-interactions {drugs: [Amoxicillin, Methotrexate], allergies: [Penicillin]}
    API->>CDS: Rule-Based & Knowledge Graph Check
    CDS-->>D: CRITICAL ALERT: Penicillin Allergy Conflict & Drug Interaction Warning!
    D->>API: POST /api/v1/prescriptions (Approved Safe Alternatives: Azithromycin)
    API->>PH: Create Dispense Order (FEFO Batch Reserved)
    D->>API: POST /api/v1/lab/orders (Order: CBC + Liver Function)
    API->>LB: Create Lab Sample Worklist Item
    D->>API: POST /api/v1/queue/{id}/complete (Finish Consultation)
    API->>BL: Auto-generate Consolidated Invoice (Consultation + Rx + Lab)
```

---

## 5. Activity Diagram (Complete Patient Journey)

```mermaid
stateDiagram-v2
    [*] --> Discovered: Patient Books Online / Walk-in
    Discovered --> CheckedIn: Arrives at Clinic & Scans QR
    CheckedIn --> Triaged: Nurse records Vitals & Triage Level
    Triaged --> InQueue: Hybrid Priority Token Generated & ETA Calculated
    InQueue --> InConsultation: Doctor Calls Next Token
    state InConsultation {
        [*] --> ReviewEHR
        ReviewEHR --> ClinicalNotes: SOAP / Voice Drafting
        ClinicalNotes --> CDSCheck: Drug Interactions & Guidelines
        CDSCheck --> ApproveRxLab: Issue Prescription & Lab Orders
        ApproveRxLab --> [*]
    }
    InConsultation --> LabAndPharmacy: Patient Proceeds to Services
    state LabAndPharmacy {
        [*] --> SampleCollection
        SampleCollection --> LabResultEntry
        [*] --> MedicineDispensing
    }
    LabAndPharmacy --> BillingSettlement: Itemized Invoicing
    BillingSettlement --> FollowUpAndFeedback: Scheduled Reminder & Feedback
    FollowUpAndFeedback --> [*]
```
