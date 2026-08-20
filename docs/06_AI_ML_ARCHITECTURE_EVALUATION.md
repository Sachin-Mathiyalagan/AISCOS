# AISCOS — AI & Machine Learning Architecture & Evaluation

## 1. Machine Learning Pipelines

AISCOS incorporates multiple specialized machine learning models and clinical AI systems:

```
                          +-----------------------------------+
                          |     AISCOS AI PLATFORM ENGINE     |
                          +-----------------+-----------------+
                                            |
            +-------------------------------+-------------------------------+
            |                               |                               |
+-----------v-----------+       +-----------v-----------+       +-----------v-----------+
| Waiting-Time Regressor|       |  No-Show Classifier   |       | Clinical Decision RAG |
| GradientBoostingRegressor    | RandomForestClassifier|       | Drug Checker & Vector |
| Features: 7 input vars|       | Features: 6 input vars|       | Knowledge Graph       |
+-----------+-----------+       +-----------+-----------+       +-----------+-----------+
            |                               |                               |
            v                               v                               v
MAE / RMSE / R² Metrics         ROC-AUC / F1 / Confusion        Evidence Citations & CDS
```

---

## 2. Model 1: AI Patient Waiting-Time Regressor

### 2.1 Feature Set
1. `queue_length_ahead`: Number of active waiting patients ahead of the current patient.
2. `doctor_avg_duration_min`: Historical mean consultation duration for the target doctor (minutes).
3. `current_consultation_elapsed`: Minutes elapsed in the current ongoing consultation.
4. `hour_of_day`: Arrival hour (8:00 to 20:00).
5. `day_of_week`: Monday (0) to Sunday (6).
6. `patient_acuity_score`: Computed triage severity score (1 to 4).
7. `delayed_appointments_count`: Number of delayed appointments in the department.

### 2.2 Model Selection & Benchmark
- **Baseline**: Simple Linear Regression ($\text{MAE} \approx 8.4\text{ min}$, $R^2 \approx 0.61$).
- **Selected Model**: **Gradient Boosting Regressor (GBR)** ($\text{MAE} \approx 3.1\text{ min}$, $\text{RMSE} \approx 4.2\text{ min}$, $R^2 \approx 0.91$).
- **Output**: Point estimate of waiting time (minutes) + 90% confidence interval ($\hat{y} \pm 1.645 \cdot \sigma$).

---

## 3. Model 2: AI Appointment No-Show Classifier

### 3.1 Feature Set
1. `lead_time_days`: Days between booking creation and appointment date.
2. `past_no_show_ratio`: Historical cancellation and no-show rate for this patient.
3. `patient_age`: Age in years.
4. `slot_hour`: Scheduled appointment hour.
5. `appointment_type_num`: 0: Routine, 1: Follow-up, 2: Specialist, 3: Preventive.
6. `day_of_week`: Day of week.

### 3.2 Evaluation Metrics
- **Model**: **Random Forest Classifier** with balanced class weights.
- **Metrics**: Precision = 0.84, Recall = 0.81, F1-Score = 0.82, ROC-AUC = 0.89.

---

## 4. Model 3: Clinical Decision Support (CDS) & Medical Knowledge RAG

### 4.1 Safety Architecture
- **Rule Engine**: Validates known severe drug-drug interactions (e.g., Warfarin + Ibuprofen, Metformin + Contrast Dye, ACE-Inhibitors + Potassium-Sparing Diuretics).
- **Allergy Cross-Reference**: Flags beta-lactam / penicillin cross-sensitivities automatically before prescription finalization.
- **RAG Knowledge Retrieval**: Synthesizes verified clinical guidelines (WHO, AHA, NICE) with clear source citations and evidence confidence rating.
- **Strict Human-in-the-Loop Principle**: All AI-generated suggestions, SOAP notes, and recommendations are marked `DRAFT — REQUIRES CLINICIAN REVIEW` and cannot be persisted without doctor approval.
