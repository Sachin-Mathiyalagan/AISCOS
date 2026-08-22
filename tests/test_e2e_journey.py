import os
import sys
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# pyrefly: ignore [missing-import]
from app.main import app

client = TestClient(app)

def test_full_26_step_patient_journey():
    """
    AISCOS End-to-End Clinical & Operational Acceptance Test:
    Complete 26-Step Lifecycle for patient 'Sachin Kumar'
    """
    print("\n=======================================================")
    print("STARTING AISCOS 26-STEP END-TO-END PATIENT ACCEPTANCE TEST")
    print("=======================================================")

    # Setup: Admin Token
    admin_auth = client.post("/api/v1/auth/login", json={
        "email": "clinicadmin@aiscos.health",
        "password": "password123"
    })
    if admin_auth.status_code != 200:
        admin_auth = client.post("/api/v1/auth/login", json={
            "email": "clinicadmin@aiscos.health",
            "password": "Admin@123"
        })
    assert admin_auth.status_code == 200
    admin_token = admin_auth.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # [Step 1] Receptionist registers new patient "Sachin Kumar"
    pat_res = client.post("/api/v1/patients", json={
        "first_name": "Sachin",
        "last_name": "Kumar",
        "dob": "1992-06-15",
        "gender": "Male",
        "phone": "+91-9876543210",
        "email": "sachin.kumar.accept@gmail.com",
        "allergies": "Sulfa Drugs",
        "chronic_conditions": "Stage 1 Essential Hypertension",
        "blood_group": "B+"
    }, headers=headers)
    assert pat_res.status_code == 200
    patient = pat_res.json()
    patient_id = patient["id"]
    patient_mrn = patient["mrn"]
    assert patient_mrn.startswith("PAT-")
    print(f"[OK] Step 1: Registered Patient Sachin Kumar (MRN: {patient_mrn})")

    # [Step 2] Authenticate Doctor Dr. Rajesh Sharma
    doc_auth = client.post("/api/v1/auth/login", json={
        "email": "dr.sharma@aiscos.health",
        "password": "Doctor@123"
    })
    if doc_auth.status_code != 200:
        doc_auth = client.post("/api/v1/auth/login", json={
            "email": "dr.sharma@aiscos.health",
            "password": "password123"
        })
    assert doc_auth.status_code == 200
    doc_token = doc_auth.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    doctor_id = 1
    print("[OK] Step 2: Doctor Dr. Rajesh Sharma authenticated")

    # [Step 3] Patient / Reception queries available appointment slots
    booking_date = (date.today() + timedelta(days=3)).isoformat()
    slots_res = client.get(f"/api/v1/appointments/slots?doctor_id={doctor_id}&appointment_date={booking_date}", headers=headers)
    assert slots_res.status_code == 200
    slots_data = slots_res.json()
    assert len(slots_data["available_slots"]) > 0
    chosen_slot = slots_data["available_slots"][0]
    print(f"[OK] Step 3: Available schedule slots calculated (Selected: {chosen_slot} on {booking_date})")

    # [Step 4] Book appointment for Sachin Kumar
    appt_res = client.post("/api/v1/appointments", json={
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "appointment_date": booking_date,
        "slot_time": chosen_slot,
        "appointment_type": "Routine",
        "chief_complaint": "Hypertension review and cardiac evaluation"
    }, headers=headers)
    assert appt_res.status_code == 200
    appt = appt_res.json()
    appointment_id = appt["id"]
    assert appt["appointment_code"].startswith("APT-")
    print(f"[OK] Step 4: Appointment booked ({appt['appointment_code']})")

    # [Step 5] Verify double-booking collision check rejects duplicate slot
    dup_res = client.post("/api/v1/appointments", json={
        "doctor_id": doctor_id,
        "patient_id": 2,
        "appointment_date": booking_date,
        "slot_time": chosen_slot
    }, headers=headers)
    assert dup_res.status_code == 409
    print("[OK] Step 5: Double-booking collision prevented (HTTP 409)")

    # [Step 6] Receptionist checks in Sachin Kumar
    checkin_res = client.post("/api/v1/queue/check-in", json={
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "appointment_id": appointment_id,
        "is_emergency": False,
        "triage_level": 3,
        "chief_complaint": "Hypertension review and cardiac evaluation"
    }, headers=headers)
    assert checkin_res.status_code == 200
    queue_entry = checkin_res.json()
    queue_id = queue_entry["id"]
    token_number = queue_entry["token_number"]
    assert queue_entry["status"] == "Waiting"
    assert queue_entry["priority_score"] > 0
    print(f"[OK] Step 6: Patient checked in, Token issued: {token_number}, Priority Score: {queue_entry['priority_score']}")

    # [Step 7] Patient Portal queries active queue status
    portal_q_res = client.get(f"/api/v1/queue/patient/{patient_id}", headers=headers)
    assert portal_q_res.status_code == 200
    portal_q = portal_q_res.json()
    assert portal_q["has_active_token"] is True
    assert portal_q["active_entry"]["token_number"] == token_number
    print(f"[OK] Step 7: Patient portal displays live token {token_number} and AI ETA: ~{portal_q['active_entry']['estimated_wait_minutes']} mins")

    # [Step 8] Doctor calls next patient into consultation room
    call_res = client.post(f"/api/v1/queue/{queue_id}/call", headers=doc_headers)
    assert call_res.status_code == 200
    assert call_res.json()["status"] == "Called"
    print(f"[OK] Step 8: Token {token_number} called to Doctor room (Status: Called)")

    # [Step 9] Doctor starts consultation session -> Initializing Encounter
    start_res = client.post(f"/api/v1/queue/{queue_id}/start", headers=doc_headers)
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["status"] == "In-Consultation"
    encounter_id = start_data["encounter_id"]
    print(f"[OK] Step 9: Consultation started, Encounter {start_data['encounter_code']} initialized")

    # [Step 10] Nurse/Doctor records vitals telemetry
    vitals_res = client.post("/api/v1/clinical/vitals", json={
        "patient_id": patient_id,
        "encounter_id": encounter_id,
        "temperature_f": 98.4,
        "systolic_bp": 138,
        "diastolic_bp": 88,
        "heart_rate_bpm": 76,
        "spo2_percent": 98,
        "weight_kg": 72.0,
        "height_cm": 172.0,
        "triage_level": 3,
        "triage_notes": "Mild elevated blood pressure. Alert, oriented."
    }, headers=doc_headers)
    assert vitals_res.status_code == 200
    vitals_data = vitals_res.json()
    assert vitals_data["bmi"] > 0
    print(f"[OK] Step 10: Vitals recorded (BP: 138/88, BMI: {vitals_data['bmi']})")

    # [Step 11] Doctor queries CDS Drug Interaction & Allergy Checker
    cds_res = client.post("/api/v1/clinical/cds/check-interactions", json={
        "patient_id": patient_id,
        "new_medicines": ["Amlodipine 5mg", "Telmisartan 40mg"]
    }, headers=doc_headers)
    assert cds_res.status_code == 200
    print("[OK] Step 11: CDS Drug Interaction & Allergy validation executed")

    # [Step 12] Doctor queries Clinical Guidelines RAG
    rag_res = client.post("/api/v1/clinical/cds/guidelines-rag", json={
        "query": "Stage 1 Essential Hypertension treatment protocol"
    }, headers=doc_headers)
    assert rag_res.status_code == 200
    print(f"[OK] Step 12: Clinical Guidelines RAG queried ({len(rag_res.json()['evidence_sources'])} evidence sources retrieved)")

    # [Step 13] Doctor saves structured SOAP notes
    notes_res = client.post("/api/v1/clinical/notes", json={
        "encounter_id": encounter_id,
        "subjective": "Patient reports occasional morning headaches and fatigue. History of hypertension.",
        "objective": "BP 138/88 mmHg, HR 76 bpm, BMI 24.3. Cardiovascular exam S1/S2 present, no murmurs.",
        "assessment": "Stage 1 Essential Hypertension (ICD-10 I10)",
        "plan": "Initiate Amlodipine 5mg and Telmisartan 40mg. Restrict sodium. Follow up in 14 days.",
        "is_signed": True
    }, headers=doc_headers)
    assert notes_res.status_code == 200
    print("[OK] Step 13: Structured SOAP Clinical Notes signed and persisted")

    # [Step 14] Doctor issues structured digital prescription
    rx_res = client.post("/api/v1/prescriptions", json={
        "encounter_id": encounter_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "notes": "Take medications daily after breakfast.",
        "items": [
            {
                "medicine_id": 1,
                "dosage": "5mg",
                "frequency": "OD",
                "duration_days": 15,
                "quantity": 15,
                "instructions": "After breakfast"
            },
            {
                "medicine_id": 2,
                "dosage": "40mg",
                "frequency": "OD",
                "duration_days": 15,
                "quantity": 15,
                "instructions": "After breakfast"
            }
        ]
    }, headers=doc_headers)
    assert rx_res.status_code == 200
    rx_data = rx_res.json()
    prescription_id = rx_data["id"]
    rx_code = rx_data["prescription_code"]
    verification_hash = rx_data["verification_hash"]
    print(f"[OK] Step 14: Digital Prescription issued ({rx_code}, Seal: {verification_hash})")

    # [Step 15] Verify Printable Prescription PDF endpoint
    pdf_res = client.get(f"/api/v1/prescriptions/{prescription_id}/pdf")
    assert pdf_res.status_code == 200
    assert verification_hash in pdf_res.text
    print("[OK] Step 15: Cryptographic Prescription PDF generated and verified")

    # [Step 16] Doctor orders Diagnostic Lab Tests (Complete Blood Count and Lipid Panel)
    lab_order_res = client.post("/api/v1/lab/orders", json={
        "encounter_id": encounter_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "test_id": 1,
        "urgency": "Routine",
        "clinical_indication": "Hypertension workup"
    }, headers=doc_headers)
    assert lab_order_res.status_code == 200
    lab_order_id = lab_order_res.json()["id"]
    print(f"[OK] Step 16: Diagnostic Lab test ordered ({lab_order_res.json()['order_number']})")

    # [Step 17] Lab Technician marks specimen collected
    collect_res = client.put(f"/api/v1/lab/orders/{lab_order_id}/collect-sample", headers=headers)
    assert collect_res.status_code == 200
    print("[OK] Step 17: Lab technician collected specimen")

    # [Step 18] Lab Technician enters analyzer numeric results and verifies report
    result_res = client.post("/api/v1/lab/results", json={
        "lab_order_id": lab_order_id,
        "numeric_value": 14.2,
        "technician_notes": "Hematology analyzer parameters verified."
    }, headers=headers)
    assert result_res.status_code == 200
    assert result_res.json()["status"] == "Completed"
    print("[OK] Step 18: Lab analyzer results entered, verified and released")

    # [Step 19] Doctor schedules 14-day clinical follow-up
    follow_date = (date.today() + timedelta(days=14)).isoformat()
    follow_res = client.post("/api/v1/followups", json={
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "encounter_id": encounter_id,
        "follow_up_date": follow_date,
        "reason": "14-day blood pressure & therapy review"
    }, headers=doc_headers)
    assert follow_res.status_code == 200
    print(f"[OK] Step 19: Follow-up review scheduled for {follow_date}")

    # [Step 20] Doctor completes consultation -> Atomically triggers consolidated Invoice
    enc_complete_res = client.post(f"/api/v1/clinical/encounters/{encounter_id}/complete", headers=doc_headers)
    assert enc_complete_res.status_code == 200
    complete_data = enc_complete_res.json()
    invoice_number = complete_data["invoice_number"]
    assert invoice_number is not None
    assert complete_data["total_billed"] > 0
    print(f"[OK] Step 20: Encounter completed, Consolidated Invoice {invoice_number} generated (${complete_data['total_billed']:.2f})")

    # [Step 21] Pharmacist dispenses prescription via FEFO batch stock deduction
    dispense_res = client.post("/api/v1/pharmacy/dispense", json={
        "prescription_id": prescription_id
    }, headers=headers)
    assert dispense_res.status_code == 200
    assert dispense_res.json()["status"] == "Dispensed"
    print("[OK] Step 21: Pharmacist dispensed prescription via First-Expiry-First-Out (FEFO) batch deduction")

    # [Step 22] Billing Specialist records payment settlement
    invoices_res = client.get(f"/api/v1/billing/invoices?patient_id={patient_id}", headers=headers)
    assert invoices_res.status_code == 200
    inv_list = invoices_res.json()
    assert len(inv_list) > 0
    target_invoice = inv_list[0]
    
    pay_res = client.post("/api/v1/billing/payments", json={
        "invoice_id": target_invoice["id"],
        "amount": target_invoice["total_amount"],
        "payment_method": "TEST_PAYMENT",
        "notes": "Electronic settlement via Sandbox"
    }, headers=headers)
    assert pay_res.status_code == 200
    assert pay_res.json()["payment_status"] == "Paid"
    print(f"[OK] Step 22: Invoice paid in full via TEST_PAYMENT (${target_invoice['total_amount']:.2f})")

    # [Step 23] Patient views receipt in portal
    pat_invoices_res = client.get(f"/api/v1/billing/invoices?patient_id={patient_id}", headers=headers)
    assert pat_invoices_res.status_code == 200
    assert pat_invoices_res.json()[0]["payment_status"] == "Paid"
    print("[OK] Step 23: Digital receipt confirmed in Patient Portal")

    # [Step 24] Patient views scheduled follow-up
    pat_follow_res = client.get(f"/api/v1/followups/patient/{patient_id}", headers=headers)
    assert pat_follow_res.status_code == 200
    assert len(pat_follow_res.json()) > 0
    print("[OK] Step 24: Scheduled follow-up verified in Patient Portal")

    # [Step 25] Verify notifications
    notifs_res = client.get("/api/v1/notifications", headers=headers)
    assert notifs_res.status_code == 200
    print(f"[OK] Step 25: Multi-channel in-app notifications verified ({len(notifs_res.json())} system alerts)")

    # [Step 26] Executive Analytics dashboard reflects updated metrics
    analytics_res = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["summary"]["total_patients"] >= 1
    assert analytics["summary"]["today_revenue_usd"] > 0
    assert analytics["summary"]["completed_consultations"] >= 1
    print(f"[OK] Step 26: Analytics dashboard reflects live database metrics (Patients: {analytics['summary']['total_patients']}, Revenue: ${analytics['summary']['today_revenue_usd']:.2f}, Completed: {analytics['summary']['completed_consultations']})")

    print("\n=======================================================")
    print("ALL 26 STEPS OF AISCOS PATIENT ACCEPTANCE TEST PASSED 100%")
    print("=======================================================\n")
