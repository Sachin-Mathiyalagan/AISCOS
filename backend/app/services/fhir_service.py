from typing import Dict, Any
from app.models.models import Patient, Encounter, Vitals, Prescription

class FHIRService:
    @staticmethod
    def to_fhir_patient(patient: Patient) -> Dict[str, Any]:
        return {
            "resourceType": "Patient",
            "id": str(patient.mrn),
            "identifier": [
                {
                    "system": "https://aiscos.health/patients",
                    "value": patient.mrn
                }
            ],
            "name": [
                {
                    "use": "official",
                    "family": patient.last_name,
                    "given": [patient.first_name]
                }
            ],
            "telecom": [
                {"system": "phone", "value": patient.phone, "use": "mobile"},
                {"system": "email", "value": patient.email, "use": "home"} if patient.email else None
            ],
            "gender": patient.gender.lower() if patient.gender in ["Male", "Female", "Other"] else "unknown",
            "birthDate": patient.dob.isoformat() if patient.dob else None,
            "address": [
                {
                    "use": "home",
                    "line": [patient.address] if patient.address else [],
                    "city": patient.city
                }
            ],
            "extension": [
                {
                    "url": "https://aiscos.health/fhir/StructureDefinition/blood-group",
                    "valueString": patient.blood_group
                },
                {
                    "url": "https://aiscos.health/fhir/StructureDefinition/allergies",
                    "valueString": patient.allergies
                }
            ]
        }

    @staticmethod
    def to_fhir_encounter(encounter: Encounter) -> Dict[str, Any]:
        return {
            "resourceType": "Encounter",
            "id": str(encounter.encounter_code),
            "status": "finished" if encounter.status == "Completed" else "in-progress",
            "class": {
                "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                "code": "AMB",
                "display": "ambulatory"
            },
            "subject": {
                "reference": f"Patient/{encounter.patient.mrn if encounter.patient else encounter.patient_id}"
            },
            "participant": [
                {
                    "individual": {
                        "reference": f"Practitioner/{encounter.doctor_id}",
                        "display": f"Dr. {encounter.doctor.user.full_name if encounter.doctor else 'Specialist'}"
                    }
                }
            ],
            "period": {
                "start": encounter.start_time.isoformat() if encounter.start_time else None,
                "end": encounter.end_time.isoformat() if encounter.end_time else None
            },
            "reasonCode": [
                {
                    "text": encounter.chief_complaint
                }
            ]
        }

fhir_service = FHIRService()
