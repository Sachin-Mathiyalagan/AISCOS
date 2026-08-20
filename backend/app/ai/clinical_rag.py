import re
from typing import List, Dict, Any

# Clinical Guideline Knowledge Base for RAG Retrieval
CLINICAL_GUIDELINES_KB = [
    {
        "topic": "Hypertension (Adult Stage 1 & 2)",
        "source": "AHA/ACC 2024 Hypertension Clinical Guidelines",
        "keywords": ["hypertension", "blood pressure", "high bp", "amlodipine", "losartan", "telmisartan", "ace-i", "arb"],
        "recommendation": "For Stage 1 Hypertension (130-139 / 80-89 mmHg) with ASCVD risk >10%, initiate single antihypertensive (ACE-I/ARB, CCB, or Thiazide). For Stage 2 (>=140/90 mmHg), initiate combination therapy with 2 first-line agents of different classes. Target BP: < 130/80 mmHg.",
        "evidence_level": "Class 1 (Level A)"
    },
    {
        "topic": "Type 2 Diabetes Mellitus Glycemic Control",
        "source": "ADA Standards of Care in Diabetes 2026",
        "keywords": ["diabetes", "t2d", "blood sugar", "hba1c", "metformin", "glp-1", "sglt2", "glucose"],
        "recommendation": "First-line therapy: Metformin + lifestyle modification. For patients with established ASCVD, heart failure, or CKD, add SGLT2 inhibitor (e.g., Empagliflozin) or GLP-1 RA (e.g., Semaglutide) independent of baseline HbA1c. Routine HbA1c target: < 7.0%.",
        "evidence_level": "Class 1 (Level A)"
    },
    {
        "topic": "Acute Upper Respiratory Tract Infection (URTI)",
        "source": "NICE Guidelines (NG120) & WHO Antimicrobial Stewardship",
        "keywords": ["cough", "cold", "fever", "sore throat", "urti", "rhinorrhea", "pharyngitis", "bronchitis"],
        "recommendation": "Majority of URTIs are viral; routine antibiotics are NOT recommended. Provide symptomatic relief (Paracetamol, hydration, saline nasal rinse). Prescribe antibiotics (Amoxicillin / Azithromycin) only if Centor score >= 3, symptom duration > 10-14 days with purulent discharge, or high clinical suspicion of bacterial superinfection.",
        "evidence_level": "Class 1 (Level A - Antimicrobial Stewardship)"
    },
    {
        "topic": "Adult Asthma Exacerbation & Maintenance",
        "source": "Global Initiative for Asthma (GINA 2025/2026)",
        "keywords": ["asthma", "wheezing", "shortness of breath", "inhaler", "salbutamol", "formoterol", "budesonide"],
        "recommendation": "GINA Track 1 (Preferred): As-needed low-dose Inhaled Corticosteroid (ICS)-formoterol for symptom relief across all severity steps. Avoid SABA (Salbutamol) monotherapy due to increased risk of severe exacerbations.",
        "evidence_level": "Class 1 (Level A)"
    },
    {
        "topic": "Dyslipidemia & Statin Therapy",
        "source": "ESC/EAS Dyslipidemia Guidelines",
        "keywords": ["cholesterol", "lipid", "statin", "atorvastatin", "rosuvastatin", "ldl", "triglycerides"],
        "recommendation": "High-intensity statin (Atorvastatin 40-80mg or Rosuvastatin 20-40mg) for secondary prevention in ASCVD or primary prevention in high-risk patients. Target: >=50% LDL-C reduction and LDL-C < 55 mg/dL (< 1.4 mmol/L).",
        "evidence_level": "Class 1 (Level A)"
    }
]

# Drug-Drug Interaction Knowledge Graph
DRUG_INTERACTIONS_DB = [
    {
        "drug_a": "warfarin",
        "drug_b": "ibuprofen",
        "severity": "CRITICAL",
        "effect": "Severe GI hemorrhage and amplified anticoagulation risk.",
        "recommendation": "Avoid concurrent use. Use Paracetamol / Acetaminophen for analgesia."
    },
    {
        "drug_a": "warfarin",
        "drug_b": "aspirin",
        "severity": "HIGH",
        "effect": "Increased bleeding risk without dual indication.",
        "recommendation": "Monitor INR closely if co-prescribed for acute coronary syndrome."
    },
    {
        "drug_a": "metformin",
        "drug_b": "iodinated contrast",
        "severity": "CRITICAL",
        "effect": "Contrast-induced nephropathy leading to acute Metformin accumulation and lactic acidosis.",
        "recommendation": "Withhold Metformin 48 hours before and after radiologic contrast procedure; verify eGFR."
    },
    {
        "drug_a": "enalapril",
        "drug_b": "spironolactone",
        "severity": "HIGH",
        "effect": "Severe life-threatening hyperkalemia.",
        "recommendation": "Check serum potassium and creatinine within 1 week of co-administration."
    },
    {
        "drug_a": "simvastatin",
        "drug_b": "clarithromycin",
        "severity": "HIGH",
        "effect": "CYP3A4 inhibition causing massive increase in statin plasma levels, risk of rhabdomyolysis.",
        "recommendation": "Temporarily suspend Simvastatin during Macrolide antibiotic course or switch to Azithromycin."
    },
    {
        "drug_a": "amoxicillin",
        "drug_b": "methotrexate",
        "severity": "HIGH",
        "effect": "Penicillins reduce renal clearance of Methotrexate, increasing bone marrow toxicity.",
        "recommendation": "Monitor complete blood counts and serum Methotrexate levels closely."
    }
]

# Allergy Sensitivity Graph
ALLERGY_GROUPS = {
    "penicillin": ["amoxicillin", "ampicillin", "augmentin", "piperacillin", "penicillin v", "cloxacillin"],
    "cephalosporin": ["cephalexin", "cefuroxime", "ceftriaxone", "cefixime", "cefepime"],
    "sulfa": ["sulfamethoxazole", "bactrim", "sulfasalazine", "cotrimoxazole"],
    "nsaid": ["ibuprofen", "diclofenac", "naproxen", "aspirin", "mefenamic acid", "etoricoxib"]
}

class ClinicalDecisonSupport:
    def check_drug_interactions_and_allergies(
        self,
        new_medications: List[str],
        patient_allergies: str = "None",
        current_medications: str = "None"
    ) -> Dict[str, Any]:
        alerts = []
        recommendations = []
        has_critical = False
        has_allergy_warn = False
        
        # 1. Check Allergies
        allergy_text = patient_allergies.lower()
        new_meds_clean = [m.lower().strip() for m in new_medications]
        
        for allergy_group, group_drugs in ALLERGY_GROUPS.items():
            if allergy_group in allergy_text:
                for med in new_meds_clean:
                    for group_drug in group_drugs:
                        if group_drug in med:
                            has_allergy_warn = True
                            alerts.append({
                                "type": "ALLERGY_CONFLICT",
                                "severity": "CRITICAL",
                                "title": f"Known Allergy Warning: {allergy_group.capitalize()}",
                                "description": f"Patient has documented allergy to '{allergy_group}'. Prescribing '{med.title()}' (a {allergy_group} class drug) carries severe anaphylaxis risk!",
                                "source": "AISCOS Clinical Decision Support & Allergy Safety Layer"
                            })
                            recommendations.append(f"Consider non-cross-reacting alternative (e.g. Macrolides or Fluoroquinolones if antibiotic).")
        
        # 2. Check Drug-Drug Interactions
        all_drugs_to_check = new_meds_clean.copy()
        if current_medications and current_medications.lower() != "none":
            for cm in current_medications.lower().split(","):
                if cm.strip():
                    all_drugs_to_check.append(cm.strip())
        
        for rule in DRUG_INTERACTIONS_DB:
            drug_a = rule["drug_a"]
            drug_b = rule["drug_b"]
            
            # Check if both drugs are in combined list
            match_a = any(drug_a in drug for drug in all_drugs_to_check)
            match_b = any(drug_b in drug for drug in all_drugs_to_check)
            
            if match_a and match_b:
                if rule["severity"] == "CRITICAL":
                    has_critical = True
                alerts.append({
                    "type": "DRUG_DRUG_INTERACTION",
                    "severity": rule["severity"],
                    "title": f"Interaction: {drug_a.capitalize()} + {drug_b.capitalize()}",
                    "description": rule["effect"],
                    "source": "AHA/BNF Drug Interaction Index"
                })
                recommendations.append(rule["recommendation"])
                
        return {
            "has_critical_interaction": has_critical,
            "has_allergy_warning": has_allergy_warn,
            "alerts": alerts,
            "recommendations": list(set(recommendations)),
            "safety_disclaimer": "Clinical Decision Support alerts provide evidence-backed guidance. Final prescription requires licensed doctor authorization."
        }

    def query_guidelines_rag(self, query: str) -> List[Dict[str, Any]]:
        q_tokens = set(re.findall(r'\w+', query.lower()))
        results = []
        
        for doc in CLINICAL_GUIDELINES_KB:
            # Simple keyword matching score simulating vector cosine similarity
            score = 0
            for kw in doc["keywords"]:
                if kw in query.lower():
                    score += 2
                for tok in q_tokens:
                    if tok in kw:
                        score += 1
            if score > 0:
                results.append({
                    "topic": doc["topic"],
                    "source": doc["source"],
                    "recommendation": doc["recommendation"],
                    "evidence_level": doc["evidence_level"],
                    "relevance_score": round(min(score / 5.0, 1.0), 2)
                })
        
        # Sort by relevance
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results if results else [{
            "topic": "General Evidence-Based Medical Protocols",
            "source": "WHO International Clinical Practice Guidelines",
            "recommendation": "Ensure complete vitals assessment, thorough history taking, non-pharmacological lifestyle interventions, and targeted lab diagnostics before finalizing therapy.",
            "evidence_level": "Standard Best Practice",
            "relevance_score": 0.5
        }]

    def transcribe_and_draft_soap(self, verbal_dictation: str) -> Dict[str, str]:
        """
        Parses clinical dictation into structured SOAP components.
        In production, integrated with Whisper/Gemini speech model.
        """
        text = verbal_dictation.strip()
        
        # Simple extraction heuristics for clinical dictation
        subjective = "Patient presents for consultation. " + text
        objective = "Vitals reviewed. Physical examination shows clear chest, normal heart sounds, abdomen soft non-tender."
        assessment = "Clinical evaluation indicates presentation consistent with acute complaint."
        plan = "1. Initiate supportive therapy.\n2. Prescribe standard targeted medications.\n3. Follow up in 5-7 days or sooner if red-flag symptoms emerge."
        
        if "fever" in text.lower() or "cough" in text.lower():
            assessment = "Acute Upper Respiratory Tract Infection (ICD-10 J06.9)"
            plan = "1. Tab Paracetamol 650mg TDS as needed for fever.\n2. Steam inhalation, adequate oral hydration.\n3. Prescribe 5-day antibiotic course only if symptoms worsen."
        elif "bp" in text.lower() or "pressure" in text.lower() or "hypertension" in text.lower():
            assessment = "Essential Hypertension (ICD-10 I10)"
            plan = "1. Continue daily antihypertensive therapy.\n2. Low salt diet (< 2g sodium/day), daily 30-minute aerobic exercise.\n3. Baseline serum creatinine & lipid panel."
        elif "diabetes" in text.lower() or "sugar" in text.lower():
            assessment = "Type 2 Diabetes Mellitus (ICD-10 E11.9)"
            plan = "1. Tab Metformin 500mg BD after meals.\n2. Fasting & Post-prandial blood sugar self-monitoring log.\n3. Schedule HbA1c test."
            
        return {
            "subjective": subjective,
            "objective": objective,
            "assessment": assessment,
            "plan": plan,
            "disclaimer": "DRAFT ONLY — AI-generated draft requires doctor review and modification before signing."
        }

clinical_cds = ClinicalDecisonSupport()
