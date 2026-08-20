import re
from typing import Dict, Any, List

INTENT_KNOWLEDGE_BASE = [
    {
        "patterns": [r"timing", r"hours", r"open", r"schedule", r"close", r"when.*open"],
        "response": "AISCOS Outpatient Clinic operates Monday to Saturday from 08:00 AM to 08:00 PM. Emergency and Urgent Care triage services are available 24/7."
    },
    {
        "patterns": [r"doctor", r"specialist", r"cardiolog", r"pediatric", r"ortho", r"physician"],
        "response": "We have 10+ Board-Certified Specialists across Cardiology, Pediatrics, General Medicine, Orthopedics, and ENT. You can view real-time availability and book slots directly in the Appointments tab."
    },
    {
        "patterns": [r"token", r"queue", r"wait", r"turn", r"eta", r"how long"],
        "response": "Our Smart Hybrid Queue automatically calculates your live position and AI-predicted waiting time. Check your live token under 'My Live Queue' on your patient dashboard."
    },
    {
        "patterns": [r"prescription", r"medicine", r"refill", r"pharmacy", r"drugs"],
        "response": "Your approved electronic prescriptions are instantly synced with our in-house Pharmacy and available for digital download with an authentication QR code."
    },
    {
        "patterns": [r"lab", r"test", r"report", r"blood", r"cbc", r"results"],
        "response": "Diagnostic lab orders can be tracked in real-time. Once verified by the laboratory technician, your structured report with reference ranges will appear under 'Lab Reports'."
    },
    {
        "patterns": [r"bill", r"payment", r"cost", r"fee", r"insurance", r"upi"],
        "response": "Consultation fees start at $50 / Rs. 500. Itemized invoices covering consultation, lab, and medications can be paid via Card, UPI, Cash, or processed through your Insurance provider."
    }
]

class AdministrativeChatbot:
    def process_message(self, user_message: str, patient_name: str = "Valued Patient") -> Dict[str, Any]:
        msg_clean = user_message.lower().strip()
        
        # Medical emergency boundary check
        emergency_triggers = ["chest pain", "cannot breathe", "stroke", "unconscious", "heavy bleeding", "severe trauma"]
        if any(trigger in msg_clean for trigger in emergency_triggers):
            return {
                "reply": "⚠️ MEDICAL EMERGENCY DETECTED: If you or the patient is experiencing severe life-threatening symptoms, please proceed immediately to the AISCOS Emergency Department Triage or call emergency services (911 / 112 / 108). Do not wait in the standard queue!",
                "is_emergency": True,
                "suggested_actions": ["Emergency Room Check-in", "Call Ambulance", "Notify Triage Nurse"]
            }
            
        for item in INTENT_KNOWLEDGE_BASE:
            for pattern in item["patterns"]:
                if re.search(pattern, msg_clean):
                    return {
                        "reply": f"Hello {patient_name}, {item['response']}",
                        "is_emergency": False,
                        "suggested_actions": ["Book Appointment", "Check Live Queue", "View Lab Reports"]
                    }
                    
        return {
            "reply": f"Hello {patient_name}, I am the AISCOS Smart Assistant. I can help you check clinic timings, find doctor schedules, track your live token waiting time, view electronic prescriptions, and guide you through billing. How may I assist you today?",
            "is_emergency": False,
            "suggested_actions": ["View Doctors", "Check Waiting Time", "Ask Clinic Timings"]
        }

admin_chatbot = AdministrativeChatbot()
