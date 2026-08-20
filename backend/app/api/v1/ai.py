from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.rbac import get_current_user_payload
from app.schemas.schemas import AIChatRequest
from app.ai.waiting_time_model import waiting_time_predictor
from app.ai.noshow_model import noshow_predictor
from app.ai.chatbot import admin_chatbot

router = APIRouter()

@router.post("/chat")
def chat_with_assistant(
    chat_req: AIChatRequest,
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    user_name = payload.get("sub", "Valued Patient")
    response = admin_chatbot.process_message(
        user_message=chat_req.message,
        patient_name=f"User #{user_name}"
    )
    return response

@router.post("/predict-waiting-time")
def predict_waiting_time(
    queue_length: int = Query(3, ge=0),
    doctor_avg_duration: float = Query(15.0, ge=5.0, le=45.0),
    patient_acuity: int = Query(4, ge=1, le=4),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    return waiting_time_predictor.predict(
        queue_length_ahead=queue_length,
        doctor_avg_duration_min=doctor_avg_duration,
        patient_acuity_score=patient_acuity
    )

@router.post("/predict-noshow")
def predict_appointment_noshow(
    lead_time_days: int = Query(3, ge=0, le=60),
    past_noshow_rate: float = Query(0.1, ge=0.0, le=1.0),
    patient_age: int = Query(35, ge=1, le=100),
    slot_hour: int = Query(10, ge=8, le=18),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    return noshow_predictor.predict(
        lead_time_days=lead_time_days,
        past_no_show_ratio=past_noshow_rate,
        patient_age=patient_age,
        slot_hour=slot_hour
    )

@router.get("/evaluation-metrics")
def get_ai_model_metrics(payload: dict = Depends(get_current_user_payload)) -> Any:
    """Returns empirical evaluation metrics (MAE, RMSE, R2, ROC-AUC, F1) for all deployed ML models."""
    return {
        "waiting_time_regressor": waiting_time_predictor.metrics,
        "noshow_classifier": noshow_predictor.metrics,
        "system_status": "All AI inference engines active and calibrated."
    }
