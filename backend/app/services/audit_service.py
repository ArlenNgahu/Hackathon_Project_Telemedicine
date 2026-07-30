"""
HIPAA-style audit logging + caregiver proxy permission gate.
"""

from typing import Optional, Dict

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.database import AuditLog, Patient


async def write_audit_log(
    db: AsyncSession,
    *,
    user_id: Optional[str],
    user_type: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict] = None,
) -> AuditLog:
    """Write one audit log row. Caller is responsible for committing."""
    entry = AuditLog(
        user_id=user_id,
        user_type=user_type,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details or {},
    )
    db.add(entry)
    await db.flush()
    return entry


def require_caregiver_permission(patient: Patient, action: str) -> None:
    """
    Raise 403 unless `patient` has a caregiver AND that caregiver is
    permitted to perform `action` ("schedule" or "consent").

    This only checks the *permission flags on the patient record* - it does
    not itself verify that the caller is actually the caregiver. Callers
    must combine this with their own authentication of the caregiver
    (e.g. a caregiver-scoped token, or the patient's own token when a
    caregiver is acting through the patient's session with explicit
    on-behalf-of intent).
    """
    if not patient.has_caregiver:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This patient has no caregiver on file.",
        )

    if action == "schedule" and not patient.caregiver_can_schedule:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This caregiver is not authorized to schedule appointments.",
        )

    if action == "consent" and not patient.caregiver_can_consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This caregiver is not authorized to give consent.",
        )
