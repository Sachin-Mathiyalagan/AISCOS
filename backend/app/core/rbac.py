from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

ROLE_HIERARCHY = {
    "super_admin": ["super_admin", "clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "billing_staff", "patient"],
    "clinic_admin": ["clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "billing_staff"],
    "doctor": ["doctor"],
    "nurse": ["nurse"],
    "receptionist": ["receptionist"],
    "pharmacist": ["pharmacist"],
    "lab_technician": ["lab_technician"],
    "billing_staff": ["billing_staff"],
    "patient": ["patient"],
}

def get_current_user_payload(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception

def require_roles(allowed_roles: List[str]):
    def role_checker(payload: dict = Depends(get_current_user_payload)) -> dict:
        user_role = payload.get("role")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Role not found in token."
            )
        
        # Check direct match or super_admin override
        if user_role == "super_admin" or user_role in allowed_roles:
            return payload
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Role '{user_role}' is not authorized for this operation. Required: {allowed_roles}"
        )
    return role_checker
