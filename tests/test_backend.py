import os
import sys
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.ai.waiting_time_model import waiting_time_predictor
from app.ai.noshow_model import noshow_predictor
from app.ai.clinical_rag import clinical_cds

client = TestClient(app)

def get_admin_token():
    # Try password123 then fallback
    res = client.post("/api/v1/auth/login", json={
        "email": "clinicadmin@aiscos.health",
        "password": "password123"
    })
    if res.status_code != 200:
        res = client.post("/api/v1/auth/login", json={
            "email": "clinicadmin@aiscos.health",
            "password": "Admin@123"
        })
    return res.json()["access_token"]

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"
    assert data["ai_engines"] == "ONLINE"

def test_authentication_workflow():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "dr.rajesh@aiscos.health",
        "password": "password123"
    })
    if login_res.status_code != 200:
        login_res = client.post("/api/v1/auth/login", json={
            "email": "dr.sharma@aiscos.health",
            "password": "Doctor@123"
        })
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["user"]["role"] == "doctor"
    token = token_data["access_token"]

    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert "role" in me_data
    assert me_data["role"] == "doctor"

def test_patient_registration_and_ehr():
    token = get_admin_token()
    # Register test patient
    res = client.post("/api/v1/patients", json={
        "first_name": "Test",
        "last_name": "Integration",
        "dob": "1988-04-12",
        "gender": "Female",
        "phone": "+1-555-0188",
        "allergies": "Sulfa Drugs",
        "chronic_conditions": "Asthma"
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    pat_data = res.json()
    assert "mrn" in pat_data
    assert pat_data["mrn"].startswith("PAT-")
    
    # Retrieve EHR
    ehr_res = client.get(f"/api/v1/patients/{pat_data['id']}/records", headers={"Authorization": f"Bearer {token}"})
    assert ehr_res.status_code == 200
    ehr_data = ehr_res.json()
    assert "patient" in ehr_data

def test_appointment_slots_booking_reschedule_cancel():
    token = get_admin_token()
    tomorrow = (date.today() + timedelta(days=2)).isoformat()
    
    # 1. Query available slots
    slots_res = client.get(f"/api/v1/appointments/slots?doctor_id=1&appointment_date={tomorrow}", headers={
        "Authorization": f"Bearer {token}"
    })
    assert slots_res.status_code == 200
    slots_data = slots_res.json()
    assert "available_slots" in slots_data
    assert len(slots_data["available_slots"]) > 0
    selected_slot = slots_data["available_slots"][0]
    
    # 2. Book slot
    book_res = client.post("/api/v1/appointments", json={
        "doctor_id": 1,
        "patient_id": 1,
        "appointment_date": tomorrow,
        "slot_time": selected_slot,
        "chief_complaint": "Cardiology assessment"
    }, headers={"Authorization": f"Bearer {token}"})
    assert book_res.status_code == 200
    appt_data = book_res.json()
    appt_id = appt_data["id"]
    
    # 3. Collision check: booking same slot must be rejected with 409
    dup_res = client.post("/api/v1/appointments", json={
        "doctor_id": 1,
        "patient_id": 2,
        "appointment_date": tomorrow,
        "slot_time": selected_slot
    }, headers={"Authorization": f"Bearer {token}"})
    assert dup_res.status_code == 409
    
    # 4. Reschedule appointment
    new_slot = slots_data["available_slots"][-1]
    resched_res = client.put(f"/api/v1/appointments/{appt_id}/reschedule", json={
        "appointment_date": tomorrow,
        "slot_time": new_slot,
        "reason": "Patient conflict"
    }, headers={"Authorization": f"Bearer {token}"})
    assert resched_res.status_code == 200
    assert resched_res.json()["slot_time"] == new_slot
    
    # 5. Cancel appointment
    cancel_res = client.put(f"/api/v1/appointments/{appt_id}/cancel", json={
        "reason": "Trip postponed"
    }, headers={"Authorization": f"Bearer {token}"})
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "Cancelled"

def test_smart_checkin_and_queue_flow():
    token = get_admin_token()
    # Check-in a walk-in patient (create a fresh patient to ensure clean queue state)
    pat_res = client.post("/api/v1/patients", json={
        "first_name": "Queue",
        "last_name": "Tester",
        "dob": "1995-02-10",
        "gender": "Male",
        "phone": "+1-555-0999"
    }, headers={"Authorization": f"Bearer {token}"})
    pat_id = pat_res.json()["id"]

    res = client.post("/api/v1/queue/check-in", json={
        "patient_id": pat_id,
        "doctor_id": 1,
        "is_emergency": False,
        "triage_level": 3,
        "chief_complaint": "Acute throat pain"
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    queue_data = res.json()
    assert "token_number" in queue_data
    assert queue_data["status"] == "Waiting"
    assert queue_data["estimated_wait_minutes"] >= 0
    q_id = queue_data["id"]

    # Call patient
    call_res = client.post(f"/api/v1/queue/{q_id}/call", headers={"Authorization": f"Bearer {token}"})
    assert call_res.status_code == 200
    assert call_res.json()["status"] == "Called"

    # Start consultation
    start_res = client.post(f"/api/v1/queue/{q_id}/start", headers={"Authorization": f"Bearer {token}"})
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "In-Consultation"
    assert "encounter_id" in start_res.json()

    # Complete consultation
    comp_res = client.post(f"/api/v1/queue/{q_id}/complete", headers={"Authorization": f"Bearer {token}"})
    assert comp_res.status_code == 200

def test_cds_drug_interaction_and_allergy_checker():
    res = client.post("/api/v1/clinical/cds/check-interactions", json={
        "patient_id": 1, # John Doe has Penicillin allergy
        "new_medicines": ["Amoxicillin 500mg", "Ibuprofen 400mg"]
    }, headers={"Authorization": f"Bearer {get_admin_token()}"})
    assert res.status_code == 200
    data = res.json()
    assert data["has_allergy_warning"] is True
    assert any(a.get("severity") in ["CRITICAL", "ALLERGY_CONFLICT"] or a.get("type") == "ALLERGY_CONFLICT" for a in data["alerts"])

def test_clinical_guidelines_rag():
    res = client.post("/api/v1/clinical/cds/guidelines-rag", json={
        "query": "Hypertension blood pressure target"
    }, headers={"Authorization": f"Bearer {get_admin_token()}"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["evidence_sources"]) > 0

def test_prescriptions_and_printable_pdf():
    token = get_admin_token()
    
    # 1. Create encounter
    enc_res = client.post("/api/v1/clinical/encounters", json={
        "doctor_id": 1,
        "patient_id": 1,
        "chief_complaint": "Prescription test encounter"
    }, headers={"Authorization": f"Bearer {token}"})
    enc_id = enc_res.json()["id"]

    # 2. Issue digital prescription
    rx_res = client.post("/api/v1/prescriptions", json={
        "encounter_id": enc_id,
        "patient_id": 1,
        "doctor_id": 1,
        "notes": "Take with full glass of water",
        "items": [
            {
                "medicine_id": 1,
                "dosage": "500mg",
                "frequency": "TDS",
                "duration_days": 5,
                "quantity": 15,
                "instructions": "After meals"
            }
        ]
    }, headers={"Authorization": f"Bearer {token}"})
    assert rx_res.status_code == 200
    rx_data = rx_res.json()
    assert "prescription_code" in rx_data
    assert "verification_hash" in rx_data
    rx_id = rx_data["id"]

    # 3. Retrieve Printable PDF
    pdf_res = client.get(f"/api/v1/prescriptions/{rx_id}/pdf")
    assert pdf_res.status_code == 200
    assert "text/html" in pdf_res.headers["content-type"]
    assert rx_data["verification_hash"] in pdf_res.text
    assert "PRESCRIPTION" in pdf_res.text

def test_pharmacy_fefo_dispense_and_insufficient_stock():
    token = get_admin_token()

    # 1. Create encounter and prescription requesting huge stock to verify insufficient stock rejection
    enc_res = client.post("/api/v1/clinical/encounters", json={
        "doctor_id": 1,
        "patient_id": 1,
        "chief_complaint": "Stock check encounter"
    }, headers={"Authorization": f"Bearer {token}"})
    enc_id = enc_res.json()["id"]

    over_rx = client.post("/api/v1/prescriptions", json={
        "encounter_id": enc_id,
        "patient_id": 1,
        "doctor_id": 1,
        "items": [
            {
                "medicine_id": 1,
                "dosage": "500mg",
                "frequency": "TDS",
                "duration_days": 30,
                "quantity": 999999, # Excess quantity
                "instructions": "Take as directed"
            }
        ]
    }, headers={"Authorization": f"Bearer {token}"})
    over_rx_id = over_rx.json()["id"]

    # 2. Dispensing excessive stock must be rejected with 400 Bad Request
    fail_dispense = client.post("/api/v1/pharmacy/dispense", json={
        "prescription_id": over_rx_id
    }, headers={"Authorization": f"Bearer {token}"})
    assert fail_dispense.status_code == 400
    assert "Insufficient stock" in fail_dispense.json()["detail"]

def test_academic_research_benchmark_simulation():
    res = client.get("/api/v1/analytics/research-benchmark?num_patients=100", headers={
        "Authorization": f"Bearer {get_admin_token()}"
    })
    assert res.status_code == 200
    data = res.json()
    assert "regimes" in data
    assert "fifo" in data["regimes"]
    assert "static_priority" in data["regimes"]
    assert "aiscos_ai_priority" in data["regimes"]
    assert data["regimes"]["aiscos_ai_priority"]["metrics"]["emergency_avg_wait_min"] < data["regimes"]["fifo"]["metrics"]["emergency_avg_wait_min"]

def test_fhir_interoperability_export():
    res = client.get("/api/v1/fhir/Patient/1", headers={"Authorization": f"Bearer {get_admin_token()}"})
    assert res.status_code == 200
    fhir_patient = res.json()
    assert fhir_patient["resourceType"] == "Patient"
    assert "identifier" in fhir_patient
