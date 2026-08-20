import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import QueueEntry, Appointment, Patient, Doctor, Encounter, User
from app.ai.waiting_time_model import waiting_time_predictor
from app.core.events import ws_manager
from app.services.audit_service import log_audit_event, create_system_notification

def calculate_priority_score(
    is_emergency: bool,
    triage_level: int, # 1 to 4
    has_appointment: bool,
    is_senior_or_vulnerable: bool,
    minutes_waiting: float
) -> float:
    """
    AISCOS Dynamic Multi-Factor Priority Score Formula:
    Score = Emergency + Triage_Weight + Appt_Weight + Vulnerable_Weight + AntiStarvation_Aging
    """
    if is_emergency or triage_level == 1:
        return 1000.0 # Top priority emergency
    
    triage_weights = {1: 1000.0, 2: 300.0, 3: 120.0, 4: 30.0}
    triage_score = triage_weights.get(triage_level, 30.0)
    
    appt_score = 60.0 if has_appointment else 15.0
    vuln_score = 40.0 if is_senior_or_vulnerable else 0.0
    
    # Anti-starvation aging (prevents routine walk-in patients from waiting infinitely)
    aging_score = min(minutes_waiting * 1.5, 90.0)
    
    return round(triage_score + appt_score + vuln_score + aging_score, 2)

class QueueEngine:
    def check_in_patient(
        self,
        db: Session,
        patient_id: int,
        doctor_id: int,
        appointment_id: Optional[int] = None,
        is_emergency: bool = False,
        triage_level: int = 4,
        chief_complaint: Optional[str] = None
    ) -> QueueEntry:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        
        if not patient:
            raise ValueError("Patient record not found.")
        if not doctor:
            raise ValueError("Doctor record not found.")
            
        # Check if already in active queue for this doctor
        existing = db.query(QueueEntry).filter(
            QueueEntry.patient_id == patient_id,
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status.in_(["Waiting", "Called", "In-Consultation"])
        ).first()
        if existing:
            return existing
            
        # Generate token code
        prefix = "EM" if is_emergency or triage_level == 1 else "A"
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        daily_count = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.check_in_time >= today_start
        ).count() + 1
        
        token_num = f"{prefix}-{daily_count:03d}"
        has_appt = appointment_id is not None
        
        # Calculate initial priority
        p_score = calculate_priority_score(
            is_emergency=is_emergency,
            triage_level=triage_level,
            has_appointment=has_appt,
            is_senior_or_vulnerable=patient.is_senior or False,
            minutes_waiting=0.0
        )
        
        # Determine queue length ahead
        waiting_ahead = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == "Waiting"
        ).count()
        
        # AI waiting time inference
        hour = datetime.now().hour
        dow = datetime.now().weekday()
        eta_result = waiting_time_predictor.predict(
            queue_length_ahead=waiting_ahead,
            doctor_avg_duration_min=float(doctor.avg_consultation_time or 15),
            current_consultation_elapsed=5.0,
            hour_of_day=hour,
            day_of_week=dow,
            patient_acuity_score=triage_level,
            delayed_appointments_count=0
        )
        
        queue_entry = QueueEntry(
            token_number=token_num,
            clinic_id=patient.clinic_id or 1,
            doctor_id=doctor_id,
            patient_id=patient_id,
            appointment_id=appointment_id,
            status="Waiting",
            priority_score=p_score,
            is_emergency=is_emergency,
            triage_level=triage_level,
            check_in_time=datetime.now(timezone.utc),
            estimated_wait_minutes=eta_result["predicted_wait_minutes"],
            confidence_interval_min=eta_result["confidence_interval"]["min_minutes"],
            confidence_interval_max=eta_result["confidence_interval"]["max_minutes"],
            queue_position=waiting_ahead + 1
        )
        
        db.add(queue_entry)
        
        # If appointment exists, update status
        if appointment_id:
            appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
            if appt:
                appt.status = "Checked-In"
                
        db.commit()
        db.refresh(queue_entry)
        
        # Re-sort and recalculate positions
        self.refresh_queue_order(db, doctor_id)
        
        # Create In-App Notification
        if patient.user_id:
            create_system_notification(
                db=db,
                user_id=patient.user_id,
                title="Checked In — Token Generated",
                message=f"You are checked in with Dr. {doctor.user.full_name if doctor.user else 'Specialist'}. Your token is {token_num} (Est. wait: ~{queue_entry.estimated_wait_minutes} min)."
            )
            
        return queue_entry

    def refresh_queue_order(self, db: Session, doctor_id: int):
        waiting_entries = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == "Waiting"
        ).all()
        
        now = datetime.now(timezone.utc)
        doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
        doc_avg = float(doctor.avg_consultation_time or 15) if doctor else 15.0
        
        scored_entries = []
        for entry in waiting_entries:
            check_in = entry.check_in_time
            if check_in.tzinfo is None:
                check_in = check_in.replace(tzinfo=timezone.utc)
            minutes_waited = max(0.0, (now - check_in).total_seconds() / 60.0)
            patient = db.query(Patient).filter(Patient.id == entry.patient_id).first()
            is_senior = patient.is_senior if patient else False
            
            entry.priority_score = calculate_priority_score(
                is_emergency=entry.is_emergency,
                triage_level=entry.triage_level,
                has_appointment=entry.appointment_id is not None,
                is_senior_or_vulnerable=is_senior,
                minutes_waiting=minutes_waited
            )
            scored_entries.append(entry)
            
        # Sort descending by priority score, then ascending by check-in time
        scored_entries.sort(key=lambda x: (-x.priority_score, x.check_in_time))
        
        for idx, entry in enumerate(scored_entries):
            entry.queue_position = idx + 1
            eta = waiting_time_predictor.predict(
                queue_length_ahead=idx,
                doctor_avg_duration_min=doc_avg,
                patient_acuity_score=entry.triage_level
            )
            entry.estimated_wait_minutes = eta["predicted_wait_minutes"]
            entry.confidence_interval_min = eta["confidence_interval"]["min_minutes"]
            entry.confidence_interval_max = eta["confidence_interval"]["max_minutes"]
            
        db.commit()

    def call_patient(self, db: Session, queue_id: int, doctor_id: int) -> QueueEntry:
        entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
        if not entry:
            raise ValueError("Queue entry not found.")
            
        entry.status = "Called"
        entry.called_time = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(entry)
        
        if entry.patient.user_id:
            create_system_notification(
                db=db,
                user_id=entry.patient.user_id,
                title="Token Called",
                message=f"Token {entry.token_number} is called! Please proceed to {entry.doctor.room_number if entry.doctor else 'Consultation Room'} (Dr. {entry.doctor.user.full_name if entry.doctor and entry.doctor.user else 'Doctor'})."
            )
            
        return entry

    def start_consultation(self, db: Session, queue_id: int, doctor_id: int) -> tuple[QueueEntry, Encounter]:
        entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
        if not entry:
            raise ValueError("Queue entry not found.")
            
        # Complete any other in-consultation entry for this doctor
        active_previous = db.query(QueueEntry).filter(
            QueueEntry.doctor_id == doctor_id,
            QueueEntry.status == "In-Consultation",
            QueueEntry.id != entry.id
        ).all()
        for prev in active_previous:
            prev.status = "Completed"
            prev.consultation_end_time = datetime.now(timezone.utc)
            prev_enc = db.query(Encounter).filter(Encounter.queue_entry_id == prev.id).first()
            if prev_enc and prev_enc.status == "In-Progress":
                prev_enc.status = "Completed"
                prev_enc.end_time = datetime.now(timezone.utc)
                
        entry.status = "In-Consultation"
        if not entry.called_time:
            entry.called_time = datetime.now(timezone.utc)
        entry.consultation_start_time = datetime.now(timezone.utc)
        
        # Look up or create clinical Encounter
        encounter = db.query(Encounter).filter(Encounter.queue_entry_id == entry.id).first()
        if not encounter:
            today_str = datetime.now().strftime("%Y%m%d")
            enc_count = db.query(Encounter).count() + 1
            code = f"ENC-{today_str}-{enc_count:04d}"
            
            chief_comp = "General outpatient consultation"
            if entry.appointment and entry.appointment.chief_complaint:
                chief_comp = entry.appointment.chief_complaint
                
            encounter = Encounter(
                encounter_code=code,
                clinic_id=entry.clinic_id,
                doctor_id=doctor_id,
                patient_id=entry.patient_id,
                appointment_id=entry.appointment_id,
                queue_entry_id=entry.id,
                encounter_type="Outpatient",
                chief_complaint=chief_comp,
                status="In-Progress",
                start_time=datetime.now(timezone.utc)
            )
            db.add(encounter)
            
        db.commit()
        db.refresh(entry)
        db.refresh(encounter)
        self.refresh_queue_order(db, doctor_id)
        return entry, encounter

    def complete_consultation(self, db: Session, queue_id: int) -> QueueEntry:
        entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
        if not entry:
            raise ValueError("Queue entry not found.")
            
        entry.status = "Completed"
        entry.consultation_end_time = datetime.now(timezone.utc)
        
        if entry.appointment:
            entry.appointment.status = "Completed"
            
        encounter = db.query(Encounter).filter(Encounter.queue_entry_id == entry.id).first()
        if encounter:
            encounter.status = "Completed"
            encounter.end_time = datetime.now(timezone.utc)
            try:
                from app.services.billing_service import billing_service
                billing_service.generate_encounter_invoice(db, encounter.id)
            except Exception as e:
                print(f"[BILLING] Invoice generation error in queue engine: {e}")
            
        db.commit()
        db.refresh(entry)
        self.refresh_queue_order(db, entry.doctor_id)
        return entry

    def transfer_queue_entry(self, db: Session, queue_id: int, new_doctor_id: int, reason: str, triage_level: Optional[int] = None) -> QueueEntry:
        entry = db.query(QueueEntry).filter(QueueEntry.id == queue_id).first()
        if not entry:
            raise ValueError("Queue entry not found.")
        new_doctor = db.query(Doctor).filter(Doctor.id == new_doctor_id).first()
        if not new_doctor:
            raise ValueError("Destination doctor not found.")
            
        old_doctor_id = entry.doctor_id
        entry.status = "Transferred"
        db.commit()
        
        # Create new check-in for destination doctor
        new_entry = self.check_in_patient(
            db=db,
            patient_id=entry.patient_id,
            doctor_id=new_doctor_id,
            appointment_id=entry.appointment_id,
            is_emergency=entry.is_emergency,
            triage_level=triage_level or entry.triage_level,
            chief_complaint=f"Transferred from Dr. {entry.doctor.user.full_name if entry.doctor and entry.doctor.user else old_doctor_id}: {reason}"
        )
        
        self.refresh_queue_order(db, old_doctor_id)
        return new_entry

    def get_queue_summary(self, db: Session) -> Dict[str, Any]:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        
        total_waiting = db.query(QueueEntry).filter(QueueEntry.status == "Waiting").count()
        total_called = db.query(QueueEntry).filter(QueueEntry.status == "Called").count()
        total_in_consultation = db.query(QueueEntry).filter(QueueEntry.status == "In-Consultation").count()
        total_completed_today = db.query(QueueEntry).filter(
            QueueEntry.status == "Completed",
            QueueEntry.consultation_end_time >= today_start
        ).count()
        total_today = db.query(QueueEntry).filter(QueueEntry.check_in_time >= today_start).count()
        
        # Calculate real average wait time for today
        completed_entries = db.query(QueueEntry).filter(
            QueueEntry.status == "Completed",
            QueueEntry.consultation_start_time.isnot(None),
            QueueEntry.check_in_time >= today_start
        ).all()
        
        if completed_entries:
            durations = []
            for e in completed_entries:
                start = e.consultation_start_time
                checkin = e.check_in_time
                if start and checkin:
                    if start.tzinfo is None:
                        start = start.replace(tzinfo=timezone.utc)
                    if checkin.tzinfo is None:
                        checkin = checkin.replace(tzinfo=timezone.utc)
                    durations.append(max(1.0, (start - checkin).total_seconds() / 60.0))
            avg_wait = round(sum(durations) / len(durations), 1)
        else:
            avg_wait = 12.0
            
        return {
            "total_waiting": total_waiting,
            "total_called": total_called,
            "total_in_consultation": total_in_consultation,
            "total_completed_today": total_completed_today,
            "total_queue_today": total_today,
            "avg_wait_minutes": avg_wait
        }

queue_engine = QueueEngine()
