"""
Database Schema for Quadriplegic Telemedicine Platform
SQLAlchemy ORM Models with Accessibility Focus
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, 
    ForeignKey, Enum, Float, JSON, Index, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

Base = declarative_base()

# Enums
class PriorityLevel(PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AppointmentStatus(PyEnum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class DisabilityType(PyEnum):
    QUADRIPLEGIA = "quadriplegia"
    PARAPLEGIA = "paraplegia"
    TETRAPLEGIA = "tetraplegia"
    ALS = "als"
    MS = "multiple_sclerosis"
    MD = "muscular_dystrophy"
    CP = "cerebral_palsy"
    OTHER = "other"

class AssistiveTech(PyEnum):
    NONE = "none"
    EYE_TRACKING = "eye_tracking"
    HEAD_MOUSE = "head_mouse"
    SIP_PUFF = "sip_and_puff"
    SWITCH = "switch_access"
    VOICE = "voice_control"
    CAREGIVER_PROXY = "caregiver_proxy"

class CommunicationMode(PyEnum):
    TEXT = "text"
    VOICE = "voice"
    VIDEO = "video"
    CAREGIVER_MEDIATED = "caregiver_mediated"

# ================= PATIENT MODEL =================

class Patient(Base):
    """
    Patient model with accessibility-first design.
    Stores disability-specific needs and assistive technology preferences.
    """
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)

    # Basic Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    # phone_primary doubles as the login identifier (see auth/login), so it
    # must be unique. Expected format is E.164 (e.g. "+254712345678").
    phone_primary = Column(String(20), unique=True, nullable=False, index=True)
    phone_emergency = Column(String(20), nullable=True)

    # Authentication
    password_hash = Column(String(255), nullable=False)

    # Localization - drives which language SMS/notification templates and
    # Kiswahili-aware triage keyword matching use for this patient.
    preferred_language = Column(String(10), default="en", nullable=False)

    # Disability Information (Critical for accessibility)
    disability_type = Column(Enum(DisabilityType), default=DisabilityType.QUADRIPLEGIA)
    disability_description = Column(Text, nullable=True)  # Additional details
    disability_onset_date = Column(DateTime, nullable=True)

    # Assistive Technology Profile
    primary_assistive_tech = Column(Enum(AssistiveTech), default=AssistiveTech.VOICE)
    secondary_assistive_tech = Column(Enum(AssistiveTech), nullable=True)
    assistive_tech_details = Column(JSON, default={})  # Device-specific settings

    # Communication Preferences
    preferred_communication = Column(Enum(CommunicationMode), default=CommunicationMode.VOICE)
    communication_notes = Column(Text, nullable=True)  # Speech patterns, breathing support needs

    # Accessibility Settings
    ui_preferences = Column(JSON, default={
        "font_size": "large",
        "contrast": "high",
        "color_scheme": "dark",
        "click_target_size": "extra_large",
        "dwell_time_ms": 2000,  # For eye tracking
        "voice_activation": True,
        "auto_scroll": True
    })

    # Caregiver Information
    has_caregiver = Column(Boolean, default=False)
    caregiver_name = Column(String(200), nullable=True)
    caregiver_phone = Column(String(20), nullable=True)
    caregiver_email = Column(String(255), nullable=True)
    caregiver_relationship = Column(String(50), nullable=True)
    caregiver_can_schedule = Column(Boolean, default=False)
    caregiver_can_consent = Column(Boolean, default=False)

    # Medical Profile
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_type = Column(String(5), nullable=True)
    allergies = Column(JSON, default=[])
    medications = Column(JSON, default=[])
    chronic_conditions = Column(JSON, default=[])

    # Address (for home visits)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    country = Column(String(100), default="Kenya")
    postal_code = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Account Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    triage_records = relationship("TriageRecord", back_populates="patient", lazy="dynamic")
    appointments = relationship("Appointment", back_populates="patient", lazy="dynamic")
    queue_tickets = relationship("QueueTicket", back_populates="patient", lazy="dynamic")

    def __repr__(self):
        return f"<Patient {self.first_name} {self.last_name} ({self.disability_type.value})>"

    def to_dict(self):
        return {
            "id": self.uuid,
            "name": f"{self.first_name} {self.last_name}",
            "disability": self.disability_type.value,
            "assistive_tech": self.primary_assistive_tech.value,
            "caregiver": self.caregiver_name if self.has_caregiver else None,
            "communication": self.preferred_communication.value
        }

# ================= DOCTOR MODEL =================

class Doctor(Base):
    """
    Doctor/Clinician model with availability and specialty tracking.
    """
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)

    # Basic Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), nullable=False)

    # Professional Info
    license_number = Column(String(50), unique=True, nullable=False)
    specialty = Column(String(100), nullable=False)  # e.g., "General Practice", "Neurology"
    sub_specialty = Column(String(100), nullable=True)  # e.g., "Spinal Cord Injury"
    years_experience = Column(Integer, default=0)

    # Availability
    is_active = Column(Boolean, default=True)
    is_available_now = Column(Boolean, default=False)
    max_patients_per_day = Column(Integer, default=20)
    current_queue_count = Column(Integer, default=0)

    # Schedule Template (JSON for flexibility)
    weekly_schedule = Column(JSON, default={
        "monday": {"start": "08:00", "end": "17:00", "available": True},
        "tuesday": {"start": "08:00", "end": "17:00", "available": True},
        "wednesday": {"start": "08:00", "end": "17:00", "available": True},
        "thursday": {"start": "08:00", "end": "17:00", "available": True},
        "friday": {"start": "08:00", "end": "17:00", "available": True},
        "saturday": {"start": "09:00", "end": "13:00", "available": False},
        "sunday": {"start": "09:00", "end": "13:00", "available": False}
    })

    # Consultation Modes
    does_teleconsult = Column(Boolean, default=True)
    does_home_visits = Column(Boolean, default=False)
    does_hospital = Column(Boolean, default=True)

    # Accessibility Training
    disability_training_completed = Column(Boolean, default=False)
    disability_training_date = Column(DateTime, nullable=True)

    # Ratings
    rating_average = Column(Float, default=5.0)
    rating_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    appointments = relationship("Appointment", back_populates="doctor", lazy="dynamic")

    def __repr__(self):
        return f"<Dr. {self.first_name} {self.last_name} - {self.specialty}>"

# ================= TRIAGE RECORD MODEL =================

class TriageRecord(Base):
    """
    AI Triage results with symptom analysis and priority assignment.
    """
    __tablename__ = "triage_records"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Input Data
    symptoms_description = Column(Text, nullable=False)
    symptoms_voice_url = Column(String(500), nullable=True)  # S3 URL
    symptoms_transcribed = Column(Text, nullable=True)  # Whisper transcription

    # AI Analysis
    priority_level = Column(Enum(PriorityLevel), nullable=False)
    priority_confidence = Column(Float, nullable=False)  # 0.0 - 1.0

    # Triage Decision
    recommended_action = Column(String(50), nullable=False)  # "teleconsult", "hospital", "home_visit", "self_care"
    estimated_urgency_minutes = Column(Integer, nullable=True)  # How soon they need care

    # Reasoning
    ai_reasoning = Column(Text, nullable=True)  # Explainable AI output
    matched_symptoms = Column(JSON, default=[])  # Symptoms that triggered priority
    potential_conditions = Column(JSON, default=[])  # Top 3 differential diagnoses

    # Human Override
    nurse_reviewed = Column(Boolean, default=False)
    nurse_override = Column(Boolean, default=False)
    nurse_notes = Column(Text, nullable=True)
    final_priority = Column(Enum(PriorityLevel), nullable=True)  # After nurse review

    # Outcome tracking
    actual_outcome = Column(String(50), nullable=True)  # What actually happened
    outcome_accuracy = Column(Boolean, nullable=True)  # Was AI correct?

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="triage_records")
    appointment = relationship("Appointment", back_populates="triage_record", uselist=False)

    # Indexes
    __table_args__ = (
        Index('idx_triage_priority_created', 'priority_level', 'created_at'),
        Index('idx_triage_patient_created', 'patient_id', 'created_at'),
    )

# ================= QUEUE TICKET MODEL =================

class QueueTicket(Base):
    """
    Virtual queue ticket with priority-based positioning.
    Implements two-layer priority: Clinical urgency + Accessibility needs.
    """
    __tablename__ = "queue_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(20), unique=True, nullable=False)  # e.g., "VT-20240316-001"

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)

    # Queue Context
    queue_type = Column(String(50), default="hospital")  # "hospital", "teleconsult", "home_visit"

    # Priority (Two-layer system)
    clinical_priority = Column(Enum(PriorityLevel), nullable=False)
    accessibility_priority = Column(Integer, default=0)  # 0=none, 1=PWD standard, 2=urgent PWD
    composite_score = Column(Float, nullable=False)  # Lower = higher priority

    # Position tracking
    queue_position = Column(Integer, nullable=True)  # Current position (updated dynamically)
    total_in_queue = Column(Integer, nullable=True)

    # Timing
    estimated_wait_minutes = Column(Integer, nullable=True)
    eta_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    called_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Status
    status = Column(String(20), default="waiting")  # waiting, called, serving, completed, cancelled

    # Teleconsult fallback
    teleconsult_offered = Column(Boolean, default=False)
    teleconsult_accepted = Column(Boolean, default=False)
    teleconsult_reason = Column(String(100), nullable=True)  # Why offered (long_wait, preference, etc.)

    # Notifications
    sms_sent_created = Column(Boolean, default=False)
    sms_sent_called = Column(Boolean, default=False)
    caregiver_notified = Column(Boolean, default=False)

    # Relationships
    patient = relationship("Patient", back_populates="queue_tickets")
    appointment = relationship("Appointment", back_populates="queue_ticket", uselist=False)

    # Indexes
    __table_args__ = (
        Index('idx_queue_status_score', 'status', 'composite_score'),
        Index('idx_queue_patient_active', 'patient_id', 'status'),
    )

# ================= APPOINTMENT MODEL =================

class Appointment(Base):
    """
    Scheduled appointments linking patients, doctors, and triage results.
    """
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)  # Null if not assigned yet
    triage_record_id = Column(Integer, ForeignKey("triage_records.id"), nullable=True)
    queue_ticket_id = Column(Integer, ForeignKey("queue_tickets.id"), nullable=True)

    # Appointment Details
    appointment_type = Column(String(50), nullable=False)  # "teleconsult", "hospital", "home_visit"
    scheduled_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=30)

    # Status
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED)

    # Location (for hospital or home visit)
    location_address = Column(String(500), nullable=True)
    location_latitude = Column(Float, nullable=True)
    location_longitude = Column(Float, nullable=True)

    # Virtual Meeting (for teleconsult)
    meeting_url = Column(String(500), nullable=True)
    meeting_id = Column(String(100), nullable=True)
    meeting_password = Column(String(50), nullable=True)

    # Accessibility Accommodations
    accessibility_needs = Column(JSON, default=[])
    interpreter_required = Column(Boolean, default=False)
    interpreter_language = Column(String(50), nullable=True)

    # Reminders
    reminder_sent_24h = Column(Boolean, default=False)
    reminder_sent_1h = Column(Boolean, default=False)
    reminder_sent_15m = Column(Boolean, default=False)
    caregiver_reminder_sent = Column(Boolean, default=False)

    # Outcome
    notes = Column(Text, nullable=True)
    prescription_given = Column(Boolean, default=False)
    follow_up_required = Column(Boolean, default=False)
    follow_up_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")
    triage_record = relationship("TriageRecord", back_populates="appointment")
    queue_ticket = relationship("QueueTicket", back_populates="appointment")

    # Indexes
    __table_args__ = (
        Index('idx_appointment_time', 'scheduled_time', 'status'),
        Index('idx_appointment_doctor_time', 'doctor_id', 'scheduled_time'),
        Index('idx_appointment_patient_time', 'patient_id', 'scheduled_time'),
    )

# ================= NOTIFICATION LOG MODEL =================

class NotificationLog(Base):
    """
    Audit log for all SMS, email, and push notifications.
    """
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()))

    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    notification_type = Column(String(50), nullable=False)  # "sms", "email", "push", "voice"

    # Content
    recipient = Column(String(255), nullable=False)  # Phone or email
    message_content = Column(Text, nullable=False)
    message_template = Column(String(100), nullable=True)

    # Status
    status = Column(String(20), default="pending")  # pending, sent, delivered, failed
    provider_response = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # Context
    related_to = Column(String(50), nullable=True)  # "appointment", "queue", "triage"
    related_id = Column(String(36), nullable=True)  # UUID of related record

    created_at = Column(DateTime, default=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index('idx_notification_patient', 'patient_id', 'created_at'),
        Index('idx_notification_status', 'status', 'created_at'),
    )

# ================= AUDIT LOG MODEL =================

class AuditLog(Base):
    """
    HIPAA-compliant audit log for all data access.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    user_id = Column(String(36), nullable=True)  # Patient or Doctor UUID
    user_type = Column(String(20), nullable=True)  # "patient", "doctor", "system", "caregiver"

    action = Column(String(50), nullable=False)  # "create", "read", "update", "delete"
    resource_type = Column(String(50), nullable=False)  # "patient", "triage", "appointment"
    resource_id = Column(String(36), nullable=True)

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    details = Column(JSON, nullable=True)  # Additional context

    # Indexes
    __table_args__ = (
        Index('idx_audit_user', 'user_id', 'timestamp'),
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
    )
