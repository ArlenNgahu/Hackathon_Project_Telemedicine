"""
Security utilities for authentication and authorization.
Implements JWT tokens with accessibility-friendly session management.
"""

from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.models.database import Patient, Doctor

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme - accessible endpoints don't require complex forms
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False  # Allow custom handling for accessibility
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token for extended sessions (accessibility)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_token_pair(patient: Patient) -> dict:
    """
    Issue an access + refresh token pair for a patient.
    The JWT subject ("sub") is the patient's public UUID, never the
    internal integer primary key, so we never leak DB row IDs to clients.
    """
    token_data = {"sub": patient.uuid}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None


async def authenticate_patient(
    db: AsyncSession,
    phone_primary: str,
    password: str,
) -> Optional[Patient]:
    """
    Verify phone + password credentials and return the matching Patient,
    or None if the credentials are invalid. Used by POST /auth/login.
    """
    result = await db.execute(
        select(Patient).where(Patient.phone_primary == phone_primary)
    )
    patient = result.scalar_one_or_none()

    if patient is None:
        # Run the hash comparison anyway against a dummy hash so that
        # "unknown phone number" and "wrong password" take the same amount
        # of time, which avoids leaking account existence via timing.
        pwd_context.verify(password, pwd_context.hash("not-a-real-password"))
        return None

    if not verify_password(password, patient.password_hash):
        return None

    return patient


async def get_current_patient(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Patient:
    """Get current authenticated patient with accessibility checks."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    patient_uuid: str = payload.get("sub")
    if patient_uuid is None:
        raise credentials_exception

    # Get patient from database
    result = await db.execute(
        select(Patient).where(Patient.uuid == patient_uuid)
    )
    patient = result.scalar_one_or_none()

    if patient is None:
        raise credentials_exception

    if not patient.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled"
        )

    return patient


async def get_current_doctor(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Doctor:
    """Get current authenticated doctor."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception

    doctor_uuid: str = payload.get("sub")
    if doctor_uuid is None:
        raise credentials_exception

    result = await db.execute(
        select(Doctor).where(Doctor.uuid == doctor_uuid)
    )
    doctor = result.scalar_one_or_none()

    if doctor is None:
        raise credentials_exception

    return doctor


# Accessibility-friendly auth for voice/SMS interfaces
async def get_current_patient_alternative(
    patient_uuid: Optional[str] = None,
    phone: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
) -> Optional[Patient]:
    """
    Alternative authentication for accessible interfaces.
    Supports patient UUID from voice sessions or phone number from SMS.

    NOTE: this intentionally bypasses password checks for low-friction
    channels (IVR/SMS) that are themselves gated by phone-number possession
    (e.g. an inbound SMS/call from the patient's registered number). Do not
    reuse this for anything reachable directly from an unauthenticated HTTP
    client without an equivalent out-of-band trust signal.
    """
    if patient_uuid:
        result = await db.execute(
            select(Patient).where(Patient.uuid == patient_uuid)
        )
        return result.scalar_one_or_none()

    if phone:
        result = await db.execute(
            select(Patient).where(Patient.phone_primary == phone)
        )
        return result.scalar_one_or_none()

    return None
