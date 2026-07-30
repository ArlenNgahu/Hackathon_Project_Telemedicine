"""
AfyaConnect Telemedicine Platform - FastAPI Backend
Accessibility-first API with voice support and assistive technology integration
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import uvicorn
import os
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import services
from backend.app.services.triage_service import analyze_patient_symptoms
from backend.app.services.queue_service import add_patient_to_queue, virtual_queue
from backend.app.services.notification_service import send_notification
from backend.app.services.audit_service import write_audit_log, require_caregiver_permission

from backend.app.db.session import get_db
from backend.app.models.database import (
    Patient, Appointment, TriageRecord,
    DisabilityType as DBDisabilityType,
    AssistiveTech as DBAssistiveTech,
    PriorityLevel as DBPriorityLevel,
)
from backend.app.core.security import (
    get_password_hash,
    authenticate_patient,
    create_token_pair,
    create_access_token,
    decode_token,
    get_current_patient,
)
from backend.app.core.config import settings

# Initialize FastAPI app
app = FastAPI(
    title="AfyaConnect Telemedicine API",
    description="""
    Accessibility-first telemedicine platform for quadriplegic patients.

    Key Features:
    - Voice-first symptom reporting
    - AI triage with SCI-specific complication detection
    - Virtual queue with two-layer priority (clinical + accessibility)
    - Automatic teleconsult for long waits
    - Caregiver proxy mode
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS - Allow all origins for development (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict to known domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ============= ENUMS =============

class DisabilityType(str, Enum):
    QUADRIPLEGIA = "quadriplegia"
    PARAPLEGIA = "paraplegia"
    ALS = "als"
    MS = "ms"
    OTHER = "other"

class AssistiveTech(str, Enum):
    NONE = "none"
    EYE_TRACKING = "eye_tracking"
    HEAD_MOUSE = "head_mouse"
    SIP_PUFF = "sip_puff"
    SWITCH = "switch"
    VOICE = "voice"
    CAREGIVER_PROXY = "caregiver_proxy"

class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# ============= PYDANTIC MODELS =============

class PatientProfileUpdate(BaseModel):
    """
    Accessibility profile completion, filled in by an already-authenticated
    patient after /auth/register. Does not touch identity/credentials
    (phone_primary, password) - those are set once at registration and
    changed via dedicated endpoints, not here.
    """
    phone_emergency: Optional[str] = None
    preferred_language: Optional[str] = Field(None, pattern="^(en|sw)$")

    # Disability info
    disability_type: Optional[DisabilityType] = None
    disability_description: Optional[str] = None

    # Assistive technology
    primary_assistive_tech: Optional[AssistiveTech] = None
    secondary_assistive_tech: Optional[AssistiveTech] = None

    # Communication
    preferred_communication: Optional[str] = None  # voice, text, video, caregiver
    communication_notes: Optional[str] = None

    # Caregiver
    has_caregiver: Optional[bool] = None
    caregiver_name: Optional[str] = None
    caregiver_phone: Optional[str] = None
    caregiver_can_schedule: Optional[bool] = None
    caregiver_can_consent: Optional[bool] = None

    # Address
    address_line1: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AuthRegisterRequest(BaseModel):
    """Minimal account creation - phone + password only."""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_primary: str = Field(..., min_length=10)
    password: str = Field(..., min_length=8)
    preferred_language: str = Field("en", pattern="^(en|sw)$")


class AuthLoginRequest(BaseModel):
    phone_primary: str = Field(..., min_length=10)
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int

class SymptomReport(BaseModel):
    """Symptom report via text or voice."""
    patient_id: str
    symptoms_text: str = Field(..., min_length=10, description="Describe your symptoms")
    voice_recording_url: Optional[str] = None
    pain_level: Optional[int] = Field(None, ge=0, le=10)
    duration_hours: Optional[int] = None
    language: Optional[str] = Field(
        None, pattern="^(en|sw)$",
        description="Overrides the patient's saved preferred_language for this report if set."
    )

class TriageResponse(BaseModel):
    """AI Triage result."""
    priority: str
    confidence: float
    recommended_action: str
    urgency_minutes: Optional[int]
    reasoning: str
    matched_symptoms: List[str]
    potential_conditions: List[Dict]

class QueueTicketRequest(BaseModel):
    """Request to join virtual queue."""
    patient_id: str
    patient_name: str
    priority: str  # low, medium, high, critical
    is_pwd: bool = True
    preferred_time: Optional[datetime] = None

class QueueStatusResponse(BaseModel):
    """Queue status with position and ETA."""
    ticket_id: str
    position: int
    total_waiting: int
    estimated_wait_minutes: int
    eta: Optional[str]
    teleconsult_offered: bool
    message: str

class AppointmentRequest(BaseModel):
    """Schedule appointment after triage."""
    patient_id: str
    triage_id: str
    appointment_type: str  # teleconsult, hospital, home_visit
    preferred_date: Optional[datetime] = None
    special_needs: Optional[List[str]] = []
    acting_as_caregiver: bool = Field(
        False, description="Set true when a caregiver is booking on the patient's behalf."
    )

class VoiceCommand(BaseModel):
    """Voice command processing."""
    patient_id: str
    audio_data: str  # Base64 encoded audio
    command_type: str  # "symptom_report", "queue_status", "emergency"

# ============= API ENDPOINTS =============

@app.get("/")
def root():
    """API root with system status."""
    return {
        "service": "AfyaConnect Telemedicine Platform",
        "version": "1.0.0",
        "status": "operational",
        "accessibility_features": [
            "voice_first_interface",
            "eye_tracking_support",
            "switch_access_compatible",
            "caregiver_proxy_mode",
            "large_touch_targets",
            "high_contrast_mode"
        ],
        "endpoints": {
            "auth_register": "/auth/register",
            "auth_login": "/auth/login",
            "patient_profile": "/patients/register",
            "symptom_report": "/triage/report",
            "queue_join": "/queue/join",
            "queue_status": "/queue/status/{ticket_id}",
            "voice_command": "/voice/command"
        }
    }

@app.post("/patients/register")
async def complete_patient_profile(
    profile: PatientProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(get_current_patient),
):
    """
    Fill in / update the accessibility profile for the authenticated patient.

    This is step 2 of signup: call POST /auth/register first to create the
    phone+password account and get a token, then call this (with that
    token) to save disability info, assistive tech, caregiver details, etc.
    Only fields present in the request body are changed - omit a field to
    leave it as-is.
    """
    updates = profile.model_dump(exclude_unset=True)

    if "disability_type" in updates:
        updates["disability_type"] = DBDisabilityType[profile.disability_type.name]
    if "primary_assistive_tech" in updates:
        updates["primary_assistive_tech"] = DBAssistiveTech[profile.primary_assistive_tech.name]
    if "secondary_assistive_tech" in updates:
        updates["secondary_assistive_tech"] = (
            DBAssistiveTech[profile.secondary_assistive_tech.name]
            if profile.secondary_assistive_tech else None
        )

    for field, value in updates.items():
        setattr(current_patient, field, value)

    await db.commit()
    await db.refresh(current_patient)

    await write_audit_log(
        db, user_id=current_patient.uuid, user_type="patient",
        action="update", resource_type="patient", resource_id=current_patient.uuid,
        details={"updated_fields": list(updates.keys())},
    )
    await db.commit()

    primary_tech = (
        AssistiveTech(current_patient.primary_assistive_tech.value)
        if current_patient.primary_assistive_tech
        and current_patient.primary_assistive_tech.value in AssistiveTech._value2member_map_
        else AssistiveTech.NONE
    )

    return {
        "success": True,
        "patient_id": current_patient.uuid,
        "message": f"Thanks {current_patient.first_name}, your accessibility profile has been saved.",
        "accessibility_settings": {
            "primary_tech": primary_tech,
            "ui_recommendations": _get_ui_recommendations(primary_tech)
        },
    }


# ============= AUTH ENDPOINTS =============

@app.post("/auth/register", response_model=TokenResponse)
async def auth_register(payload: AuthRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Minimal account creation (phone + password), no accessibility profile."""
    existing = await db.execute(
        select(Patient).where(Patient.phone_primary == payload.phone_primary)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this phone number already exists.")

    db_patient = Patient(
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone_primary=payload.phone_primary,
        password_hash=get_password_hash(payload.password),
        preferred_language=payload.preferred_language,
    )
    db.add(db_patient)
    await db.commit()
    await db.refresh(db_patient)

    await write_audit_log(
        db, user_id=db_patient.uuid, user_type="patient",
        action="create", resource_type="patient", resource_id=db_patient.uuid,
    )
    await db.commit()

    return create_token_pair(db_patient)


@app.post("/auth/login", response_model=TokenResponse)
async def auth_login(payload: AuthLoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with phone + password."""
    patient = await authenticate_patient(db, payload.phone_primary, payload.password)
    if patient is None:
        raise HTTPException(status_code=401, detail="Incorrect phone number or password")
    if not patient.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    patient.last_login = datetime.utcnow()
    await db.commit()

    return create_token_pair(patient)


@app.post("/auth/refresh", response_model=TokenResponse)
async def auth_refresh(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    decoded = decode_token(payload.refresh_token)
    if decoded is None or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    patient_uuid = decoded.get("sub")
    result = await db.execute(select(Patient).where(Patient.uuid == patient_uuid))
    patient = result.scalar_one_or_none()
    if patient is None or not patient.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    access_token = create_access_token({"sub": patient.uuid})
    return TokenResponse(
        access_token=access_token,
        refresh_token=payload.refresh_token,  # not rotating refresh tokens for MVP
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@app.get("/auth/me")
async def auth_me(current_patient: Patient = Depends(get_current_patient)):
    """
    Return the authenticated patient's profile + UI recommendations.
    Called by the mobile app on every launch to restore accessibility state.
    """
    return {
        "patient_id": current_patient.uuid,
        "first_name": current_patient.first_name,
        "last_name": current_patient.last_name,
        "phone_primary": current_patient.phone_primary,
        "preferred_language": current_patient.preferred_language,
        "disability_type": current_patient.disability_type.value if current_patient.disability_type else None,
        "primary_assistive_tech": current_patient.primary_assistive_tech.value if current_patient.primary_assistive_tech else None,
        "has_caregiver": current_patient.has_caregiver,
        "caregiver_can_schedule": current_patient.caregiver_can_schedule,
        "caregiver_can_consent": current_patient.caregiver_can_consent,
        "ui_recommendations": _get_ui_recommendations(
            AssistiveTech(current_patient.primary_assistive_tech.value)
            if current_patient.primary_assistive_tech
            and current_patient.primary_assistive_tech.value in AssistiveTech._value2member_map_
            else AssistiveTech.NONE
        ),
    }

def _get_ui_recommendations(tech: AssistiveTech) -> Dict:
    """Generate UI recommendations based on assistive technology."""
    recommendations = {
        AssistiveTech.EYE_TRACKING: {
            "click_target_size": "80x80px",
            "dwell_time_ms": 1500,
            "layout": "sparse",
            "gaze_reactive": True
        },
        AssistiveTech.HEAD_MOUSE: {
            "click_target_size": "60x60px",
            "sticky_buttons": True,
            "motion_smoothing": True
        },
        AssistiveTech.SIP_PUFF: {
            "scanning_speed": "medium",
            "binary_input_mode": True,
            "simplified_interface": True
        },
        AssistiveTech.VOICE: {
            "voice_activation": True,
            "continuous_listening": False,
            "wake_word": "Hey Doc"
        },
        AssistiveTech.SWITCH: {
            "scanning_mode": "auto",
            "scan_speed_ms": 2000,
            "switch_count": 1
        },
        AssistiveTech.CAREGIVER_PROXY: {
            "caregiver_mode": True,
            "patient_consent_required": True,
            "audit_logging": True
        }
    }
    return recommendations.get(tech, {})

@app.post("/triage/report", response_model=TriageResponse)
async def report_symptoms(report: SymptomReport, db: AsyncSession = Depends(get_db)):
    """
    Submit symptom report for AI triage.
    Supports text or voice input (voice transcribed automatically), and
    English or Kiswahili symptom text.
    """
    result_patient = await db.execute(select(Patient).where(Patient.uuid == report.patient_id))
    patient = result_patient.scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        result = analyze_patient_symptoms(
            symptoms=report.symptoms_text,
            disability_type=patient.disability_type.value if patient.disability_type else "quadriplegia",
            is_pwd=True,
            language=report.language,
            preferred_language=patient.preferred_language,
        )

        triage_record = TriageRecord(
            patient_id=patient.id,
            symptoms_description=report.symptoms_text,
            symptoms_voice_url=report.voice_recording_url,
            priority_level=DBPriorityLevel(result["priority"]),
            priority_confidence=result["confidence"],
            recommended_action=result["recommended_action"],
            estimated_urgency_minutes=result["urgency_minutes"],
            ai_reasoning=result["reasoning"],
            matched_symptoms=result["matched_symptoms"],
            potential_conditions=result["potential_conditions"],
        )
        db.add(triage_record)
        await db.commit()

        if result["priority"] == "critical":
            await send_notification(
                db, patient, notification_type="sms", template_key="triage_critical",
                related_to="triage", related_id=triage_record.uuid,
            )

        return TriageResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Triage analysis failed: {str(e)}")

@app.post("/appointments")
async def create_appointment(
    request: AppointmentRequest,
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(get_current_patient),
):
    """
    Schedule an appointment following triage.

    If `acting_as_caregiver` is set, the caregiver must be authorized via
    the patient's `caregiver_can_schedule` flag - every caregiver-proxy
    booking is written to the audit log regardless of outcome.
    """
    if request.patient_id != current_patient.uuid:
        raise HTTPException(status_code=403, detail="Cannot schedule an appointment for another patient's account")

    triage_result = await db.execute(
        select(TriageRecord).where(TriageRecord.uuid == request.triage_id)
    )
    triage_record = triage_result.scalar_one_or_none()
    if triage_record is None:
        raise HTTPException(status_code=404, detail="Triage record not found")

    user_type = "patient"
    if request.acting_as_caregiver:
        require_caregiver_permission(current_patient, action="schedule")
        user_type = "caregiver"

    appointment = Appointment(
        patient_id=current_patient.id,
        triage_record_id=triage_record.id,
        appointment_type=request.appointment_type,
        scheduled_time=request.preferred_date or (datetime.utcnow() + timedelta(hours=1)),
        accessibility_needs=request.special_needs or [],
    )
    db.add(appointment)
    await db.flush()

    await write_audit_log(
        db,
        user_id=current_patient.uuid,
        user_type=user_type,
        action="create",
        resource_type="appointment",
        resource_id=appointment.uuid,
        details={"acting_as_caregiver": request.acting_as_caregiver, "appointment_type": request.appointment_type},
    )
    await db.commit()
    await db.refresh(appointment)

    await send_notification(
        db, current_patient, notification_type="sms", template_key="appointment_confirmed",
        context={"appointment_type": appointment.appointment_type, "scheduled_time": appointment.scheduled_time.isoformat()},
        related_to="appointment", related_id=appointment.uuid,
    )

    return {
        "success": True,
        "appointment_id": appointment.uuid,
        "appointment_type": appointment.appointment_type,
        "scheduled_time": appointment.scheduled_time.isoformat(),
        "status": appointment.status.value,
    }


@app.post("/queue/join")
def join_queue(request: QueueTicketRequest):
    """
    Join virtual queue with priority-based positioning.

    Two-layer priority:
    1. Clinical urgency (CRITICAL > HIGH > MEDIUM > LOW)
    2. Accessibility (PWDs prioritized within same clinical tier)
    """
    try:
        result = add_patient_to_queue(
            patient_id=request.patient_id,
            patient_name=request.patient_name,
            priority=request.priority,
            is_pwd=request.is_pwd
        )

        # Check if teleconsult should be offered
        if result["estimated_wait_minutes"] > 45 and request.priority in ["low", "medium"]:
            result["teleconsult_recommended"] = True
            result["message"] += " Teleconsult available to avoid long wait."

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Queue join failed: {str(e)}")

@app.get("/queue/status/{ticket_id}")
def get_queue_status(ticket_id: str):
    """Get current position and ETA in queue."""
    status = virtual_queue.get_queue_status(ticket_id)

    if "your_ticket" not in status:
        raise HTTPException(status_code=404, detail="Ticket not found")

    your_ticket = status["your_ticket"]

    return {
        "ticket_id": ticket_id,
        "position": your_ticket["position"],
        "total_waiting": status["total_waiting"],
        "estimated_wait_minutes": your_ticket["estimated_wait_minutes"],
        "eta": your_ticket["eta"],
        "clinical_priority": your_ticket["clinical_priority"],
        "is_pwd": your_ticket["is_pwd"],
        "teleconsult_offered": your_ticket["teleconsult_offered"],
        "message": f"You are position {your_ticket['position']} of {status['total_waiting']}. "
                   f"Estimated wait: {your_ticket['estimated_wait_minutes']} minutes."
    }

@app.post("/queue/teleconsult/accept/{ticket_id}")
def accept_teleconsult(ticket_id: str):
    """
    Accept teleconsult offer to avoid physical queue wait.
    Removes patient from physical queue, schedules video consultation.
    """
    success = virtual_queue.accept_teleconsult(ticket_id)

    if success:
        return {
            "success": True,
            "message": "Teleconsult accepted. You will receive a video call link via SMS.",
            "next_steps": [
                "Check SMS for meeting link",
                "Test camera and microphone",
                "Have medications list ready",
                "Caregiver can join if needed"
            ]
        }
    else:
        raise HTTPException(status_code=400, detail="Cannot accept teleconsult for this ticket")

@app.post("/voice/command")
def process_voice_command(command: VoiceCommand):
    """
    Process voice command for hands-free operation.
    Supports: symptom reporting, queue status, emergency alerts
    """
    # In production: Use Whisper API for transcription
    # For MVP: Simulated response

    if command.command_type == "emergency":
        return {
            "action": "emergency_alert",
            "message": "Emergency services notified. Stay calm, help is coming.",
            "emergency_contacts_called": True,
            "ambulance_dispatched": False  # Would assess based on location
        }

    elif command.command_type == "queue_status":
        return {
            "action": "queue_status_voice",
            "spoken_response": "You are position 3 in queue. Estimated wait: 25 minutes. "
                               "Would you like me to schedule a teleconsult instead?",
            "options": ["yes_teleconsult", "no_wait", "caregiver_help"]
        }

    elif command.command_type == "symptom_report":
        return {
            "action": "symptom_captured",
            "message": "Symptoms recorded. Analyzing now...",
            "transcription": "Patient reports chest pain and difficulty breathing",
            "triage_result": {
                "priority": "CRITICAL",
                "action": "immediate_hospital"
            }
        }

    return {"action": "unknown", "message": "Command not recognized"}

@app.get("/accessibility/fairness-metrics")
def get_fairness_metrics():
    """
    Get queue fairness metrics to ensure PWDs are accommodated
    without disadvantaging other patients.
    """
    metrics = virtual_queue.get_fairness_metrics()

    return {
        "metrics": metrics,
        "explanation": {
            "average_wait_pwd": "Average wait time for patients with disabilities",
            "average_wait_non_pwd": "Average wait time for patients without disabilities",
            "wait_difference": "Difference in wait times (should be < 10 minutes for equity)",
            "fairness_assessment": "Equitable if difference is small, showing PWDs get accommodation without excessive priority"
        }
    }

@app.get("/health")
def health_check():
    """System health check."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "api": "operational",
            "triage_model": "loaded",
            "queue_system": "active",
            "voice_processing": "ready"
        }
    }

# ============= BACKGROUND TASKS =============

def send_reminder_notifications():
    """Background task to send appointment reminders."""
    # Would run via Celery beat schedule
    pass

def process_voice_recordings():
    """Background task to transcribe voice recordings."""
    # Would use Whisper API
    pass

# ============= MAIN =============

if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════════════════════════════╗
    ║  AfyaConnect Telemedicine Platform - Starting                 ║
    ║  Accessibility: Voice-first | Eye-tracking | Switch-access     ║
    ╚════════════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
