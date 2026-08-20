# AISCOS — Queue Optimization Algorithm Specification

## 1. Research Problem & Mathematical Model

In outpatient clinic workflows, purely First-In-First-Out (FIFO) token queues cause significant clinical hazards (e.g., acute cases deteriorating in the waiting area) and severe operational inefficiencies (e.g., booked appointment patients waiting behind walk-ins).

AISCOS utilizes a **Hybrid Multi-Factor Dynamic Priority Heap with Anti-Starvation Aging**:

### 1.1 Priority Score Formula

$$PriorityScore_i(t) = w_E \cdot E_i + w_T \cdot T_i + w_A \cdot A_i + w_S \cdot S_i + w_W \cdot \min\left(\frac{t - t_{arr,i}}{\tau_{max}}, 1.0\right) \cdot 100$$

Where:
- $E_i \in \{0, 1\}$: Emergency override flag ($w_E = 1000$).
- $T_i \in [1, 4]$: Triage Acuity Level ($w_T = 200$ for Level 1 Resuscitation, $150$ for Level 2 Emergent, $80$ for Level 3 Urgent, $20$ for Level 4 Routine).
- $A_i \in [0, 1]$: Pre-booked Appointment compliance factor ($w_A = 50$ if patient arrived on time for their slot, $10$ if late walk-in).
- $S_i \in [0, 1]$: Vulnerable population indicator ($w_S = 35$ for Senior Citizens $\ge 65$, Infants $\le 2$, or Pregnant patients).
- $\frac{t - t_{arr,i}}{\tau_{max}}$: **Anti-Starvation Aging Term**. Ensures that low-priority routine patients do not wait indefinitely. For every minute spent waiting, their dynamic score rises linearly until aging caps at $\tau_{max} = 90\text{ minutes}$ ($w_W = 40$).

---

## 2. Dynamic Priority Queue Algorithm

```python
import heapq
import time

class PriorityQueueEntry:
    def __init__(self, patient_id, token_num, arrival_time, is_emergency, triage_level, has_appointment, is_vulnerable):
        self.patient_id = patient_id
        self.token_num = token_num
        self.arrival_time = arrival_time
        self.is_emergency = is_emergency
        self.triage_level = triage_level  # 1 (Highest) to 4 (Lowest)
        self.has_appointment = has_appointment
        self.is_vulnerable = is_vulnerable

    def compute_priority(self, current_time=None):
        if current_time is None:
            current_time = time.time()
        
        # Hard emergency override
        if self.is_emergency:
            return 999999
        
        # Triage component
        triage_weights = {1: 400, 2: 250, 3: 100, 4: 20}
        triage_score = triage_weights.get(self.triage_level, 20)
        
        # Appointment adherence
        appt_score = 60 if self.has_appointment else 15
        
        # Vulnerable status
        vuln_score = 40 if self.is_vulnerable else 0
        
        # Anti-starvation aging (1 point per minute of waiting)
        wait_minutes = (current_time - self.arrival_time) / 60.0
        aging_score = min(wait_minutes * 1.5, 90.0)
        
        return triage_score + appt_score + vuln_score + aging_score
```

---

## 3. Real-Time Dynamic Queue Re-Ranking

When an event occurs (e.g. Doctor calls patient, new emergency check-in, or 3-minute ticker):
1. Recalculate priority scores for all active waiting tokens.
2. Sort max-heap by calculated dynamic score.
3. Compute personalized AI waiting time for each token in order.
4. Broadcast updated state through WebSocket topic `clinic:queue:{doctor_id}`.
