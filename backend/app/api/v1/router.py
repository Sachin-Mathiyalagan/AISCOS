from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.patients import router as patients_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.queue import router as queue_router
from app.api.v1.clinical import router as clinical_router
from app.api.v1.prescriptions import router as prescriptions_router
from app.api.v1.lab import router as lab_router
from app.api.v1.pharmacy import router as pharmacy_router
from app.api.v1.billing import router as billing_router
from app.api.v1.followups import router as followups_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.ai import router as ai_router
from app.api.v1.audit_notif_fhir import router as audit_notif_fhir_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication & Identity"])
api_router.include_router(patients_router, prefix="/patients", tags=["Patient Management & Longitudinal EHR"])
api_router.include_router(appointments_router, prefix="/appointments", tags=["Appointment Scheduling"])
api_router.include_router(queue_router, prefix="/queue", tags=["Smart Hybrid Queue & Digital Tokens"])
api_router.include_router(clinical_router, prefix="/clinical", tags=["Clinical Consultation, SOAP & CDS"])
api_router.include_router(prescriptions_router, prefix="/prescriptions", tags=["Structured Digital Prescriptions"])
api_router.include_router(lab_router, prefix="/lab", tags=["Laboratory Management"])
api_router.include_router(pharmacy_router, prefix="/pharmacy", tags=["Pharmacy & FEFO Inventory"])
api_router.include_router(billing_router, prefix="/billing", tags=["Billing, Invoicing & Payments"])
api_router.include_router(followups_router, prefix="/followups", tags=["Follow-up Management"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Clinic Operational Analytics"])
api_router.include_router(ai_router, prefix="/ai", tags=["AI & Machine Learning Engine"])
api_router.include_router(audit_notif_fhir_router, tags=["Audit Logs, Notifications & FHIR"])
