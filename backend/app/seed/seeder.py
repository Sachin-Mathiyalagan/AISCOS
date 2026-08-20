import os
import sys
import random
from datetime import datetime, date, timedelta, timezone

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.models import (
    Organization, Clinic, Department, User, Doctor, DoctorSchedule, Patient,
    Appointment, QueueEntry, Encounter, Vitals, ClinicalNote, Medicine,
    InventoryBatch, Prescription, PrescriptionItem, LabTest, LabOrder,
    LabResult, Invoice, InvoiceItem, Payment, FollowUp, Notification,
    Feedback, AuditLog
)
from app.services.queue_engine import calculate_priority_score

FIRST_NAMES = [
    "Aarav", "Ananya", "Rohan", "Priya", "Rahul", "Neha", "Vikram", "Sneha",
    "Aditya", "Pooja", "Arjun", "Kavita", "Siddharth", "Meera", "Karan", "Tanvi",
    "John", "Emma", "Michael", "Sophia", "David", "Olivia", "James", "Isabella",
    "Robert", "Mia", "William", "Charlotte", "Joseph", "Amelia", "Daniel", "Harper",
    "Sunil", "Rajesh", "Suresh", "Manoj", "Deepak", "Amit", "Alok", "Naveen",
    "Gaurav", "Manish", "Varun", "Ashok", "Sanjay", "Ramesh", "Dinesh", "Kishore"
]

LAST_NAMES = [
    "Sharma", "Patel", "Verma", "Rao", "Gupta", "Singh", "Kumar", "Iyer",
    "Reddy", "Nair", "Deshmukh", "Chopra", "Mehta", "Bhat", "Mukherjee", "Das",
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas"
]

BLOOD_GROUPS = ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"]
CHRONIC_CONDITIONS = [
    "None", "Essential Hypertension", "Type 2 Diabetes Mellitus",
    "Bronchial Asthma", "Dyslipidemia", "Coronary Artery Disease",
    "Hypothyroidism", "Osteoarthritis", "GERD"
]
ALLERGIES_LIST = [
    "None", "Penicillin", "Sulfa Drugs", "Aspirin / NSAIDs",
    "Cephalosporins", "Dust Mites", "Peanuts", "None", "None"
]

MEDICINES_DATA = [
    ("Augmentin 625 Duo", "Amoxicillin + Clavulanic Acid", "Antibiotic", "Tablet", "625mg", 22.50),
    ("Metformin 500mg", "Metformin Hydrochloride", "Antidiabetic", "Tablet", "500mg", 4.20),
    ("Amlodipine 5mg", "Amlodipine Besylate", "Antihypertensive", "Tablet", "5mg", 3.50),
    ("Paracetamol 650mg", "Paracetamol / Acetaminophen", "Analgesic / Antipyretic", "Tablet", "650mg", 2.00),
    ("Atorvastatin 20mg", "Atorvastatin Calcium", "Lipid Lowering", "Tablet", "20mg", 14.80),
    ("Azithromycin 500mg", "Azithromycin Dihydrate", "Antibiotic", "Tablet", "500mg", 18.00),
    ("Telmisartan 40mg", "Telmisartan", "Antihypertensive", "Tablet", "40mg", 8.50),
    ("Pantoprazole 40mg", "Pantoprazole Sodium", "Proton Pump Inhibitor", "Tablet", "40mg", 7.00),
    ("Salbutamol Inhaler 100mcg", "Salbutamol Sulfate", "Bronchodilator", "Inhaler", "100mcg/puff", 45.00),
    ("Cetirizine 10mg", "Cetirizine Hydrochloride", "Antihistamine", "Tablet", "10mg", 3.00),
    ("Ibuprofen 400mg", "Ibuprofen", "NSAID", "Tablet", "400mg", 4.50),
    ("Warfarin 5mg", "Warfarin Sodium", "Anticoagulant", "Tablet", "5mg", 12.00),
    ("Erythromycin 250mg", "Erythromycin", "Antibiotic", "Tablet", "250mg", 11.00),
    ("Ciprofloxacin 500mg", "Ciprofloxacin Hydrochloride", "Antibiotic", "Tablet", "500mg", 13.50),
    ("Montelukast 10mg", "Montelukast Sodium", "Leukotriene Antagonist", "Tablet", "10mg", 9.00),
]

LAB_TESTS_DATA = [
    ("Complete Blood Count (CBC)", "LAB-CBC-01", "Blood", 4.0, 11.0, "4.0 - 11.0 x10^3/uL", "x10^3/uL", 25.0),
    ("Fasting Blood Glucose", "LAB-FBG-01", "Blood", 70.0, 99.0, "70 - 99 mg/dL", "mg/dL", 15.0),
    ("HbA1c Glycated Hemoglobin", "LAB-HBA1C-01", "Blood", 4.0, 5.6, "< 5.7 % Normal", "%", 30.0),
    ("Lipid Panel Profile", "LAB-LIPID-01", "Serum", 100.0, 200.0, "< 200 mg/dL Total Cholesterol", "mg/dL", 40.0),
    ("Liver Function Test (LFT)", "LAB-LFT-01", "Serum", 10.0, 40.0, "ALT 7-56 U/L, AST 10-40 U/L", "U/L", 35.0),
    ("Kidney Function Test (RFT / KFT)", "LAB-RFT-01", "Serum", 0.7, 1.3, "Creatinine 0.7 - 1.3 mg/dL", "mg/dL", 35.0),
    ("Serum Electrolytes (Na/K/Cl)", "LAB-ELECT-01", "Serum", 135.0, 145.0, "Na 135-145 mEq/L", "mEq/L", 28.0),
    ("Thyroid Stimulating Hormone (TSH)", "LAB-TSH-01", "Serum", 0.4, 4.0, "0.4 - 4.0 uIU/mL", "uIU/mL", 32.0),
    ("Routine Urine Examination", "LAB-URINE-01", "Urine", None, None, "Clear, Protein Nil, Sugar Nil", "N/A", 12.0),
    ("Chest X-Ray PA View", "LAB-CXR-01", "Imaging", None, None, "Normal Lung Parenchyma & Cardia", "N/A", 45.0),
]

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if already seeded
    if db.query(Organization).first():
        print("[DATABASE] Database already seeded. Skipping initial generation.")
        db.close()
        return

    print("[DATABASE SEEDER] Generating rich, production-grade synthetic healthcare dataset...")
    
    # 1. Organization & Clinic
    org = Organization(name="AISCOS Healthcare Network", code="ORG-AISCOS-01")
    db.add(org)
    db.commit()
    db.refresh(org)
    
    clinic = Clinic(
        organization_id=org.id,
        name="AISCOS Central Multi-Specialty Clinic & Hospital",
        code="CLN-AISCOS-MAIN",
        address="452 Healthcare Boulevard, Tech City",
        city="Metro Hub",
        phone="+1 (800) 555-0199",
        email="contact@aiscos.health"
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    
    # 2. Departments
    dept_names = [
        ("General & Family Medicine", "GENMED", "Floor 1", "Comprehensive primary care, acute triage, and preventive checkups"),
        ("Cardiology", "CARDIO", "Floor 2", "Advanced cardiovascular diagnostics, ECG, echocardiography, and hypertension care"),
        ("Pediatrics & Child Health", "PEDIA", "Floor 1", "Neonatal care, vaccination, childhood infectious illness, and growth monitoring"),
        ("Orthopedics & Sports Medicine", "ORTHO", "Floor 3", "Bone, joint, trauma care, fracture management, and physical therapy"),
        ("Pulmonology & Respiratory Care", "PULMO", "Floor 2", "Asthma, COPD, respiratory allergy, and pulmonary function testing"),
    ]
    dept_objs = []
    for name, code, floor, desc in dept_names:
        d = Department(clinic_id=clinic.id, name=name, code=code, floor=floor, description=desc)
        db.add(d)
        dept_objs.append(d)
    db.commit()
    for d in dept_objs:
        db.refresh(d)
        
    # 3. Staff Demo Users
    roles_users_data = [
        ("Super Administrator", "superadmin@aiscos.health", "Admin@123", "super_admin", "+1-800-001"),
        ("Clinic Administrator", "clinicadmin@aiscos.health", "Admin@123", "clinic_admin", "+1-800-002"),
        ("Nurse Mary Johnson", "nurse.mary@aiscos.health", "Nurse@123", "nurse", "+1-800-003"),
        ("Receptionist Sarah Davis", "reception@aiscos.health", "Reception@123", "receptionist", "+1-800-004"),
        ("Pharmacist David Miller", "pharmacist.david@aiscos.health", "Pharmacy@123", "pharmacist", "+1-800-005"),
        ("Lab Tech Alex Wilson", "labtech.alex@aiscos.health", "Lab@123", "lab_technician", "+1-800-006"),
        ("Billing Specialist Emma Brown", "billing.sarah@aiscos.health", "Billing@123", "billing_staff", "+1-800-007"),
    ]
    
    for full_name, email, password, role, phone in roles_users_data:
        u = User(
            clinic_id=clinic.id,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            phone=phone,
            role=role,
            is_active=True
        )
        db.add(u)
    db.commit()
    
    # 4. Doctors (10 Doctors across specialties)
    doctors_info = [
        ("Dr. Rajesh Sharma", "dr.sharma@aiscos.health", "Doctor@123", dept_objs[1].id, "LIC-MD-CARDIO-881", "Senior Cardiologist", "MD, DM (Cardiology), FACC", "Room 201", 60.0, 15),
        ("Dr. Ananya Patel", "dr.patel@aiscos.health", "Doctor@123", dept_objs[2].id, "LIC-MD-PEDIA-904", "Consultant Pediatrician", "MD (Pediatrics), DNB", "Room 105", 50.0, 12),
        ("Dr. Vikram Rao", "dr.rao@aiscos.health", "Doctor@123", dept_objs[0].id, "LIC-MD-GENMED-772", "Lead Physician (General Medicine)", "MD (Internal Medicine)", "Room 102", 45.0, 15),
        ("Dr. Sneha Verma", "dr.verma@aiscos.health", "Doctor@123", dept_objs[3].id, "LIC-MD-ORTHO-615", "Orthopedic Surgeon", "MS (Orthopedics), MCh", "Room 304", 65.0, 18),
        ("Dr. Rohan Mehta", "dr.mehta@aiscos.health", "Doctor@123", dept_objs[4].id, "LIC-MD-PULMO-523", "Pulmonologist & Sleep Specialist", "MD (Pulmonary Med)", "Room 208", 55.0, 15),
        ("Dr. Neha Gupta", "dr.gupta@aiscos.health", "Doctor@123", dept_objs[0].id, "LIC-MD-GENMED-441", "Family Medicine Physician", "MBBS, MRCGP", "Room 103", 40.0, 12),
        ("Dr. Arjun Reddy", "dr.reddy@aiscos.health", "Doctor@123", dept_objs[1].id, "LIC-MD-CARDIO-329", "Interventional Cardiologist", "MD, DM, FSCAI", "Room 203", 70.0, 20),
        ("Dr. Meera Nair", "dr.nair@aiscos.health", "Doctor@123", dept_objs[2].id, "LIC-MD-PEDIA-218", "Pediatric Specialist", "MD (Pediatrics)", "Room 106", 50.0, 12),
        ("Dr. Siddharth Kumar", "dr.kumar@aiscos.health", "Doctor@123", dept_objs[3].id, "LIC-MD-ORTHO-195", "Joint Replacement Surgeon", "MS (Ortho)", "Room 306", 65.0, 18),
        ("Dr. Pooja Deshmukh", "dr.deshmukh@aiscos.health", "Doctor@123", dept_objs[4].id, "LIC-MD-PULMO-112", "Chest Physician", "MD (Respiratory)", "Room 209", 55.0, 15),
    ]
    
    doctor_objs = []
    for full_name, email, password, dept_id, lic, spec, qual, room, fee, avg_t in doctors_info:
        u = User(
            clinic_id=clinic.id,
            email=email,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            phone="+1-555-DOC-" + lic[-3:],
            role="doctor",
            is_active=True
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        
        doc = Doctor(
            user_id=u.id,
            department_id=dept_id,
            license_number=lic,
            specialty=spec,
            qualification=qual,
            room_number=room,
            consultation_fee=fee,
            avg_consultation_time=avg_t,
            is_available=True
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doctor_objs.append(doc)
        
        # Doctor Schedules (Mon-Fri 09:00 - 17:00)
        for dow in range(5):
            sched = DoctorSchedule(
                doctor_id=doc.id,
                day_of_week=dow,
                start_time="09:00",
                end_time="17:00",
                slot_duration_mins=avg_t,
                is_active=True
            )
            db.add(sched)
        db.commit()
    for d in doctor_objs:
        db.refresh(d)
        
    # 5. Medicines & Inventory Batches
    med_objs = []
    for name, gen, cat, form, strength, price in MEDICINES_DATA:
        m = Medicine(
            name=name,
            generic_name=gen,
            category=cat,
            dosage_form=form,
            strength=strength,
            unit_price=price,
            requires_prescription=True,
            side_effects="Standard clinical monitoring required."
        )
        db.add(m)
        med_objs.append(m)
    db.commit()
    for m in med_objs:
        db.refresh(m)
        
        # Add 2 batches per medicine with FEFO dates
        b1 = InventoryBatch(
            medicine_id=m.id,
            clinic_id=clinic.id,
            batch_number=f"BAT-{m.id}01-2026",
            expiry_date=date.today() + timedelta(days=random.randint(90, 240)),
            quantity_in_stock=random.randint(150, 400),
            reorder_level=30,
            cost_price=round(m.unit_price * 0.6, 2),
            unit_selling_price=m.unit_price,
            supplier_name="Apex Healthcare Global"
        )
        b2 = InventoryBatch(
            medicine_id=m.id,
            clinic_id=clinic.id,
            batch_number=f"BAT-{m.id}02-2027",
            expiry_date=date.today() + timedelta(days=random.randint(300, 600)),
            quantity_in_stock=random.randint(200, 500),
            reorder_level=30,
            cost_price=round(m.unit_price * 0.6, 2),
            unit_selling_price=m.unit_price,
            supplier_name="MediLife Pharmaceuticals"
        )
        db.add_all([b1, b2])
    db.commit()
    
    # 6. Lab Tests
    lab_test_objs = []
    for name, code, stype, min_v, max_v, ntext, unit, price in LAB_TESTS_DATA:
        lt = LabTest(
            name=name,
            code=code,
            department_id=dept_objs[0].id,
            sample_type=stype,
            normal_range_min=min_v,
            normal_range_max=max_v,
            normal_range_text=ntext,
            unit=unit,
            price=price,
            turnaround_hours=4
        )
        db.add(lt)
        lab_test_objs.append(lt)
    db.commit()
    for lt in lab_test_objs:
        db.refresh(lt)

    # 7. Demo Patient User + 100+ Synthetic Patients
    demo_patient_user = User(
        clinic_id=clinic.id,
        email="patient.john@aiscos.health",
        hashed_password=get_password_hash("Patient@123"),
        full_name="John Doe",
        phone="+1-555-PAT-0001",
        role="patient",
        is_active=True
    )
    db.add(demo_patient_user)
    db.commit()
    db.refresh(demo_patient_user)
    
    demo_patient = Patient(
        user_id=demo_patient_user.id,
        clinic_id=clinic.id,
        mrn="PAT-2026-0001",
        first_name="John",
        last_name="Doe",
        dob=date(1985, 4, 12),
        gender="Male",
        phone="+1-555-PAT-0001",
        email="patient.john@aiscos.health",
        address="742 Evergreen Terrace",
        city="Metro Hub",
        blood_group="O+",
        allergies="Penicillin",
        chronic_conditions="Essential Hypertension",
        current_medications="Amlodipine 5mg OD",
        emergency_contact_name="Jane Doe",
        emergency_contact_phone="+1-555-999-001",
        insurance_provider="BlueCross Shield",
        insurance_policy_number="BCS-8849201",
        qr_code_token="QR-PAT-2026-0001",
        is_senior=False
    )
    db.add(demo_patient)
    db.commit()
    db.refresh(demo_patient)
    
    patient_objs = [demo_patient]
    for i in range(2, 115):
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        gender = "Female" if fn in ["Ananya", "Priya", "Neha", "Pooja", "Kavita", "Meera", "Tanvi", "Emma", "Sophia", "Olivia", "Isabella", "Mia", "Charlotte", "Amelia", "Harper", "Sneha"] else "Male"
        age = random.randint(18, 82)
        dob = date(2026 - age, random.randint(1, 12), random.randint(1, 28))
        is_senior = age >= 65
        
        p = Patient(
            clinic_id=clinic.id,
            mrn=f"PAT-2026-{i:04d}",
            first_name=fn,
            last_name=ln,
            dob=dob,
            gender=gender,
            phone=f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            email=f"{fn.lower()}.{ln.lower()}{random.randint(1, 99)}@gmail.com",
            address=f"{random.randint(10, 999)} Maple Avenue, Apt {random.randint(1, 50)}",
            city="Metro Hub",
            blood_group=random.choice(BLOOD_GROUPS),
            allergies=random.choice(ALLERGIES_LIST),
            chronic_conditions=random.choice(CHRONIC_CONDITIONS),
            current_medications="None" if random.random() > 0.4 else "Metformin 500mg BD",
            emergency_contact_name=f"{random.choice(FIRST_NAMES)} {ln}",
            emergency_contact_phone="+1-555-EMERGENCY",
            insurance_provider=random.choice(["BlueCross Shield", "Aetna Health", "UnitedHealthcare", "Cigna", "Self-Pay"]),
            insurance_policy_number=f"POL-{random.randint(100000, 999999)}",
            qr_code_token=f"QR-PAT-2026-{i:04d}",
            is_senior=is_senior
        )
        db.add(p)
        patient_objs.append(p)
    db.commit()
    for p in patient_objs:
        db.refresh(p)
        
    print(f"[DATABASE SEEDER] Seeded {len(patient_objs)} patients and {len(doctor_objs)} doctors.")

    # 8. Seed 200+ Appointments, Queue Entries, Encounters, Prescriptions & Invoices
    today = date.today()
    slots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
    appt_seq = 1
    
    # Generate past appointments (Completed)
    for day_offset in range(-14, 0):
        appt_date = today + timedelta(days=day_offset)
        for doc in doctor_objs[:6]:
            for slot in random.sample(slots, 3):
                patient = random.choice(patient_objs)
                appt_seq += 1
                appt = Appointment(
                    appointment_code=f"APT-{appt_date.strftime('%Y%m%d')}-{appt_seq:05d}",
                    clinic_id=clinic.id,
                    doctor_id=doc.id,
                    patient_id=patient.id,
                    appointment_date=appt_date,
                    slot_time=slot,
                    appointment_type=random.choice(["Routine", "Follow-up", "Specialist"]),
                    status="Completed",
                    chief_complaint=random.choice(["Routine health checkup", "Mild chest discomfort", "Persistent dry cough", "Joint pain and stiffness", "Fever and body aches"]),
                    is_walk_in=random.random() < 0.2
                )
                db.add(appt)
                db.commit()
                db.refresh(appt)
                
                # Clinical Encounter
                enc = Encounter(
                    encounter_code=f"ENC-{appt_date.strftime('%Y%m%d')}-{appt.id:04d}",
                    clinic_id=clinic.id,
                    doctor_id=doc.id,
                    patient_id=patient.id,
                    appointment_id=appt.id,
                    encounter_type="Outpatient",
                    chief_complaint=appt.chief_complaint,
                    examination_notes="Patient alert and oriented. Vitals stable. Systemic examination within normal limits.",
                    diagnosis_code=random.choice(["I10", "E11.9", "J06.9", "M19.9", "J45.9"]),
                    diagnosis_title=random.choice(["Essential Hypertension", "Type 2 Diabetes Mellitus", "Acute Upper Respiratory Infection", "Osteoarthritis", "Bronchial Asthma"]),
                    treatment_plan="Pharmacological management initiated. Lifestyle modifications advised. Schedule follow-up in 2 weeks.",
                    doctor_notes="Patient counseled regarding medication adherence and red flags.",
                    status="Completed"
                )
                db.add(enc)
                db.commit()
                db.refresh(enc)
                
                # Vitals
                v = Vitals(
                    encounter_id=enc.id,
                    patient_id=patient.id,
                    temperature_f=round(random.uniform(97.8, 99.4), 1),
                    systolic_bp=random.randint(110, 145),
                    diastolic_bp=random.randint(70, 92),
                    heart_rate_bpm=random.randint(62, 88),
                    respiratory_rate=random.randint(14, 18),
                    spo2_percent=random.randint(96, 100),
                    weight_kg=round(random.uniform(55.0, 88.0), 1),
                    height_cm=round(random.uniform(155.0, 182.0), 1),
                    bmi=24.5,
                    pain_score=random.randint(0, 3),
                    triage_level=4,
                    triage_notes="Routine intake completed by triage nurse."
                )
                db.add(v)
                
                # Prescription
                rx = Prescription(
                    prescription_code=f"RX-{appt_date.strftime('%Y%m%d')}-{enc.id:04d}",
                    encounter_id=enc.id,
                    patient_id=patient.id,
                    doctor_id=doc.id,
                    notes="Take medications strictly as instructed. Stay hydrated.",
                    verification_hash=f"SHA256-{random.randint(1000000, 9999999)}",
                    status="Dispensed"
                )
                db.add(rx)
                db.commit()
                db.refresh(rx)
                
                selected_med = random.choice(med_objs)
                rx_item = PrescriptionItem(
                    prescription_id=rx.id,
                    medicine_id=selected_med.id,
                    dosage="1 Tablet",
                    frequency="BD (Twice Daily)",
                    route="Oral",
                    duration_days=5,
                    quantity=10,
                    instructions="After breakfast and dinner",
                    is_dispensed=True,
                    dispensed_quantity=10
                )
                db.add(rx_item)
                
                # Invoices & Payment
                inv = Invoice(
                    invoice_number=f"INV-{appt_date.strftime('%Y%m%d')}-{enc.id:04d}",
                    clinic_id=clinic.id,
                    patient_id=patient.id,
                    encounter_id=enc.id,
                    subtotal=doc.consultation_fee + (selected_med.unit_price * 10),
                    discount=0.0,
                    tax=round((doc.consultation_fee + (selected_med.unit_price * 10)) * 0.05, 2),
                    total_amount=round((doc.consultation_fee + (selected_med.unit_price * 10)) * 1.05, 2),
                    paid_amount=round((doc.consultation_fee + (selected_med.unit_price * 10)) * 1.05, 2),
                    payment_status="Paid"
                )
                inv.items = [
                    InvoiceItem(item_type="Consultation", description=f"Doctor Consultation - {doc.specialty}", quantity=1, unit_price=doc.consultation_fee, total_price=doc.consultation_fee),
                    InvoiceItem(item_type="Pharmacy", description=f"{selected_med.name} x10", quantity=10, unit_price=selected_med.unit_price, total_price=selected_med.unit_price * 10)
                ]
                db.add(inv)
                db.commit()
                db.refresh(inv)
                
                pay = Payment(
                    payment_reference=f"PAY-{appt_date.strftime('%Y%m%d')}-{inv.id:04d}",
                    invoice_id=inv.id,
                    payment_method=random.choice(["Card", "UPI", "Cash", "Insurance"]),
                    amount=inv.total_amount,
                    transaction_id=f"TXN-{random.randint(10000000, 99999999)}"
                )
                db.add(pay)
                
                # Feedback
                fb = Feedback(
                    patient_id=patient.id,
                    encounter_id=enc.id,
                    rating_doctor=random.choice([4, 5, 5, 5]),
                    rating_waiting=random.choice([4, 4, 5, 3]),
                    rating_facility=5,
                    comments="Excellent clinical consultation and smooth digital token flow.",
                    sentiment="Positive"
                )
                db.add(fb)
                
    db.commit()
    
    # 9. Seed Active Today's Queue & Demo Flow
    # Give Doctor 1 (Dr. Rajesh Sharma) an active live queue with Demo Patient John Doe in queue!
    lead_doc = doctor_objs[0] # Dr. Rajesh Sharma
    
    # Token 1: In Consultation
    q1 = QueueEntry(
        token_number="A-001",
        clinic_id=clinic.id,
        doctor_id=lead_doc.id,
        patient_id=patient_objs[5].id,
        status="In-Consultation",
        priority_score=120.0,
        is_emergency=False,
        triage_level=3,
        check_in_time=datetime.now(timezone.utc) - timedelta(minutes=25),
        called_time=datetime.now(timezone.utc) - timedelta(minutes=10),
        consultation_start_time=datetime.now(timezone.utc) - timedelta(minutes=10),
        estimated_wait_minutes=0,
        confidence_interval_min=0,
        confidence_interval_max=0,
        queue_position=0
    )
    db.add(q1)
    
    # Token 2: Urgent Triage Patient
    q2 = QueueEntry(
        token_number="A-002",
        clinic_id=clinic.id,
        doctor_id=lead_doc.id,
        patient_id=patient_objs[12].id,
        status="Waiting",
        priority_score=280.0,
        is_emergency=False,
        triage_level=2,
        check_in_time=datetime.now(timezone.utc) - timedelta(minutes=15),
        estimated_wait_minutes=6,
        confidence_interval_min=4,
        confidence_interval_max=9,
        queue_position=1
    )
    db.add(q2)
    
    # Token 3: Demo Patient (John Doe - PAT-2026-0001)
    q3 = QueueEntry(
        token_number="A-003",
        clinic_id=clinic.id,
        doctor_id=lead_doc.id,
        patient_id=demo_patient.id,
        status="Waiting",
        priority_score=115.0,
        is_emergency=False,
        triage_level=3,
        check_in_time=datetime.now(timezone.utc) - timedelta(minutes=8),
        estimated_wait_minutes=18,
        confidence_interval_min=14,
        confidence_interval_max=22,
        queue_position=2
    )
    db.add(q3)
    
    # Token 4: Senior Citizen Routine
    q4 = QueueEntry(
        token_number="A-004",
        clinic_id=clinic.id,
        doctor_id=lead_doc.id,
        patient_id=patient_objs[22].id,
        status="Waiting",
        priority_score=95.0,
        is_emergency=False,
        triage_level=4,
        check_in_time=datetime.now(timezone.utc) - timedelta(minutes=5),
        estimated_wait_minutes=32,
        confidence_interval_min=26,
        confidence_interval_max=38,
        queue_position=3
    )
    db.add(q4)
    
    # Today's scheduled appointments for Doctor 1 & 2
    for doc in doctor_objs[:4]:
        for i, slot in enumerate(["11:00", "11:30", "14:00", "14:30", "15:00"]):
            p = patient_objs[30 + i * 2]
            appt_seq += 1
            appt_today = Appointment(
                appointment_code=f"APT-{today.strftime('%Y%m%d')}-{appt_seq:05d}",
                clinic_id=clinic.id,
                doctor_id=doc.id,
                patient_id=p.id,
                appointment_date=today,
                slot_time=slot,
                appointment_type="Routine",
                status="Scheduled",
                chief_complaint="Follow-up consultation and prescription refill",
                is_walk_in=False
            )
            db.add(appt_today)
            
    # Add an active lab test order for demo patient
    lab_ord = LabOrder(
        order_number="LBO-2026-DEMO1",
        encounter_id=1,
        patient_id=demo_patient.id,
        doctor_id=lead_doc.id,
        test_id=lab_test_objs[0].id, # CBC
        urgency="Routine",
        status="Sample-Collected",
        sample_barcode="BAR-CBC-9941",
        clinical_indication="Routine hematology screen"
    )
    db.add(lab_ord)
    
    # Notifications for demo patient
    notif1 = Notification(
        user_id=demo_patient_user.id,
        title="Appointment Confirmed & Token Generated",
        message="Your digital token is #A-003 for Dr. Rajesh Sharma (Cardiology). Current estimated wait time is 18 minutes.",
        channel="In-App",
        is_read=False
    )
    notif2 = Notification(
        user_id=demo_patient_user.id,
        title="Lab Sample Collected",
        message="Your Complete Blood Count (CBC) sample has been collected and is in processing. Estimated turnaround: 4 hours.",
        channel="In-App",
        is_read=False
    )
    db.add_all([notif1, notif2])
    
    # Audit log entry
    audit = AuditLog(
        user_id=demo_patient_user.id,
        user_email=demo_patient_user.email,
        user_role="patient",
        action="PATIENT_CHECK_IN",
        resource_type="QueueEntry",
        resource_id="A-003",
        ip_address="127.0.0.1",
        details={"status": "Checked-In", "doctor": "Dr. Rajesh Sharma", "token": "A-003"}
    )
    db.add(audit)
    
    db.commit()
    db.close()
    print("[DATABASE SEEDER] [OK] Complete AISCOS dataset successfully seeded!")

if __name__ == "__main__":
    seed_database()
