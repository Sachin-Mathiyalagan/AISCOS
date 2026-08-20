from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import get_current_user_payload, require_roles
from app.services.analytics_service import analytics_service

router = APIRouter()

@router.get("/dashboard")
def get_executive_analytics_dashboard(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_roles(["clinic_admin", "super_admin", "doctor"]))
) -> Any:
    return analytics_service.get_dashboard_metrics(db)

@router.get("/research-benchmark")
def run_academic_simulation_benchmark(
    num_patients: int = Query(150, ge=20, le=500),
    emergency_pct: float = Query(0.05, ge=0.01, le=0.2),
    urgent_pct: float = Query(0.20, ge=0.05, le=0.5),
    appt_pct: float = Query(0.45, ge=0.1, le=0.7),
    walkin_pct: float = Query(0.30, ge=0.1, le=0.6),
    payload: dict = Depends(get_current_user_payload)
) -> Any:
    """Academic Research Benchmark evaluating FIFO vs. Static Priority vs. AISCOS Dynamic AI-Priority."""
    return analytics_service.run_research_benchmark_simulation(
        num_patients=num_patients,
        emergency_pct=emergency_pct,
        urgent_pct=urgent_pct,
        appt_pct=appt_pct,
        walkin_pct=walkin_pct
    )
