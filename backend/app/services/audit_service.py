from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models.models import AuditLog, Notification

def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[Any] = None,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    user_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    try:
        audit_entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            ip_address=ip_address,
            details=details
        )
        db.add(audit_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        # Audit logging failure should not crash main transaction but be logged
        print(f"[AUDIT ERROR] Failed to write audit log: {e}")

def create_system_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    channel: str = "In-App"
) -> Optional[Notification]:
    try:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            channel=channel,
            is_read=False
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
    except Exception as e:
        db.rollback()
        print(f"[NOTIFICATION ERROR] Failed to create notification: {e}")
        return None
