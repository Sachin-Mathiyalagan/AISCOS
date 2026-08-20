import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "AISCOS — AI-Powered Smart Clinic & Hospital Operating System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret keys & Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "aiscos-production-super-secret-jwt-key-2026-medical-grade-security")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for seamless demo
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    # Using SQLite WAL mode locally for zero-config portable execution, easily swapped to PostgreSQL in production
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aiscos_hospital.db")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # AI Models directory
    AI_MODELS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai", "saved_models")
    
    class Config:
        case_sensitive = True

settings = Settings()
