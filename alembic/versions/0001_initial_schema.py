"""initial schema

Creates every table defined in backend/app/models/database.py: patients,
doctors, triage_records, queue_tickets, appointments, notification_logs,
audit_logs. Nothing in Postgres exists before this migration runs.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-07-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum types shared across tables - defined once so create_type only fires
# on the first table that uses them, matching how SQLAlchemy's ORM-side
# `Enum(SomePyEnum)` columns (no explicit `name=`) resolve their Postgres
# type name to the lowercased Python class name.
priority_level_enum = postgresql.ENUM(
    "low", "medium", "high", "critical", name="prioritylevel", create_type=False
)
disability_type_enum = postgresql.ENUM(
    "quadriplegia", "paraplegia", "tetraplegia", "als", "multiple_sclerosis",
    "muscular_dystrophy", "cerebral_palsy", "other", name="disabilitytype", create_type=False
)
assistive_tech_enum = postgresql.ENUM(
    "none", "eye_tracking", "head_mouse", "sip_and_puff", "switch_access",
    "voice_control", "caregiver_proxy", name="assistivetech", create_type=False
)
communication_mode_enum = postgresql.ENUM(
    "text", "voice", "video", "caregiver_mediated", name="communicationmode", create_type=False
)
appointment_status_enum = postgresql.ENUM(
    "scheduled", "confirmed", "in_progress", "completed", "cancelled",
    "no_show", name="appointmentstatus", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()

    # Create enum types once, up front, so multiple tables can reference
    # them without each CREATE TABLE trying (and failing) to redefine them.
    priority_level_enum.create(bind, checkfirst=True)
    disability_type_enum.create(bind, checkfirst=True)
    assistive_tech_enum.create(bind, checkfirst=True)
    communication_mode_enum.create(bind, checkfirst=True)
    appointment_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "patients",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("uuid", sa.String(length=36), unique=True, index=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), unique=True, nullable=True),
        sa.Column("phone_primary", sa.String(length=20), nullable=False, unique=True, index=True),
        sa.Column("phone_emergency", sa.String(length=20), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("disability_type", disability_type_enum, nullable=True),
        sa.Column("disability_description", sa.Text(), nullable=True),
        sa.Column("disability_onset_date", sa.DateTime(), nullable=True),
        sa.Column("primary_assistive_tech", assistive_tech_enum, nullable=True),
        sa.Column("secondary_assistive_tech", assistive_tech_enum, nullable=True),
        sa.Column("assistive_tech_details", sa.JSON(), nullable=True),
        sa.Column("preferred_communication", communication_mode_enum, nullable=True),
        sa.Column("communication_notes", sa.Text(), nullable=True),
        sa.Column("ui_preferences", sa.JSON(), nullable=True),
        sa.Column("has_caregiver", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("caregiver_name", sa.String(length=200), nullable=True),
        sa.Column("caregiver_phone", sa.String(length=20), nullable=True),
        sa.Column("caregiver_email", sa.String(length=255), nullable=True),
        sa.Column("caregiver_relationship", sa.String(length=50), nullable=True),
        sa.Column("caregiver_can_schedule", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("caregiver_can_consent", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("date_of_birth", sa.DateTime(), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("blood_type", sa.String(length=5), nullable=True),
        sa.Column("allergies", sa.JSON(), nullable=True),
        sa.Column("medications", sa.JSON(), nullable=True),
        sa.Column("chronic_conditions", sa.JSON(), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=True),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("region", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True, server_default="Kenya"),
        sa.Column("postal_code", sa.String(length=20), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("last_login", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "doctors",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("uuid", sa.String(length=36), unique=True, index=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), unique=True, nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("license_number", sa.String(length=50), unique=True, nullable=False),
        sa.Column("specialty", sa.String(length=100), nullable=False),
        sa.Column("sub_specialty", sa.String(length=100), nullable=True),
        sa.Column("years_experience", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("is_available_now", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("max_patients_per_day", sa.Integer(), nullable=True, server_default="20"),
        sa.Column("current_queue_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("weekly_schedule", sa.JSON(), nullable=True),
        sa.Column("does_teleconsult", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("does_home_visits", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("does_hospital", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("disability_training_completed", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("disability_training_date", sa.DateTime(), nullable=True),
        sa.Column("rating_average", sa.Float(), nullable=True, server_default="5.0"),
        sa.Column("rating_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "triage_records",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("uuid", sa.String(length=36), unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("symptoms_description", sa.Text(), nullable=False),
        sa.Column("symptoms_voice_url", sa.String(length=500), nullable=True),
        sa.Column("symptoms_transcribed", sa.Text(), nullable=True),
        sa.Column("priority_level", priority_level_enum, nullable=False),
        sa.Column("priority_confidence", sa.Float(), nullable=False),
        sa.Column("recommended_action", sa.String(length=50), nullable=False),
        sa.Column("estimated_urgency_minutes", sa.Integer(), nullable=True),
        sa.Column("ai_reasoning", sa.Text(), nullable=True),
        sa.Column("matched_symptoms", sa.JSON(), nullable=True),
        sa.Column("potential_conditions", sa.JSON(), nullable=True),
        sa.Column("nurse_reviewed", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("nurse_override", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("nurse_notes", sa.Text(), nullable=True),
        sa.Column("final_priority", priority_level_enum, nullable=True),
        sa.Column("actual_outcome", sa.String(length=50), nullable=True),
        sa.Column("outcome_accuracy", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_triage_priority_created", "triage_records", ["priority_level", "created_at"])
    op.create_index("idx_triage_patient_created", "triage_records", ["patient_id", "created_at"])

    op.create_table(
        "queue_tickets",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("ticket_number", sa.String(length=20), unique=True, nullable=False),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("queue_type", sa.String(length=50), nullable=True, server_default="hospital"),
        sa.Column("clinical_priority", priority_level_enum, nullable=False),
        sa.Column("accessibility_priority", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("composite_score", sa.Float(), nullable=False),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        sa.Column("total_in_queue", sa.Integer(), nullable=True),
        sa.Column("estimated_wait_minutes", sa.Integer(), nullable=True),
        sa.Column("eta_timestamp", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("called_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True, server_default="waiting"),
        sa.Column("teleconsult_offered", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("teleconsult_accepted", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("teleconsult_reason", sa.String(length=100), nullable=True),
        sa.Column("sms_sent_created", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("sms_sent_called", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("caregiver_notified", sa.Boolean(), nullable=True, server_default=sa.false()),
    )
    op.create_index("idx_queue_status_score", "queue_tickets", ["status", "composite_score"])
    op.create_index("idx_queue_patient_active", "queue_tickets", ["patient_id", "status"])

    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("uuid", sa.String(length=36), unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctors.id"), nullable=True),
        sa.Column("triage_record_id", sa.Integer(), sa.ForeignKey("triage_records.id"), nullable=True),
        sa.Column("queue_ticket_id", sa.Integer(), sa.ForeignKey("queue_tickets.id"), nullable=True),
        sa.Column("appointment_type", sa.String(length=50), nullable=False),
        sa.Column("scheduled_time", sa.DateTime(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True, server_default="30"),
        sa.Column("status", appointment_status_enum, nullable=True, server_default="scheduled"),
        sa.Column("location_address", sa.String(length=500), nullable=True),
        sa.Column("location_latitude", sa.Float(), nullable=True),
        sa.Column("location_longitude", sa.Float(), nullable=True),
        sa.Column("meeting_url", sa.String(length=500), nullable=True),
        sa.Column("meeting_id", sa.String(length=100), nullable=True),
        sa.Column("meeting_password", sa.String(length=50), nullable=True),
        sa.Column("accessibility_needs", sa.JSON(), nullable=True),
        sa.Column("interpreter_required", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("interpreter_language", sa.String(length=50), nullable=True),
        sa.Column("reminder_sent_24h", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("reminder_sent_1h", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("reminder_sent_15m", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("caregiver_reminder_sent", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("prescription_given", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("follow_up_required", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("follow_up_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_appointment_time", "appointments", ["scheduled_time", "status"])
    op.create_index("idx_appointment_doctor_time", "appointments", ["doctor_id", "scheduled_time"])
    op.create_index("idx_appointment_patient_time", "appointments", ["patient_id", "scheduled_time"])

    op.create_table(
        "notification_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=36), unique=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("recipient", sa.String(length=255), nullable=False),
        sa.Column("message_content", sa.Text(), nullable=False),
        sa.Column("message_template", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=True, server_default="pending"),
        sa.Column("provider_response", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("related_to", sa.String(length=50), nullable=True),
        sa.Column("related_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("idx_notification_patient", "notification_logs", ["patient_id", "created_at"])
    op.create_index("idx_notification_status", "notification_logs", ["status", "created_at"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True, index=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("user_type", sa.String(length=20), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=False),
        sa.Column("resource_id", sa.String(length=36), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
    )
    op.create_index("idx_audit_user", "audit_logs", ["user_id", "timestamp"])
    op.create_index("idx_audit_resource", "audit_logs", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notification_logs")
    op.drop_table("appointments")
    op.drop_table("queue_tickets")
    op.drop_table("triage_records")
    op.drop_table("doctors")
    op.drop_table("patients")

    bind = op.get_bind()
    appointment_status_enum.drop(bind, checkfirst=True)
    communication_mode_enum.drop(bind, checkfirst=True)
    assistive_tech_enum.drop(bind, checkfirst=True)
    disability_type_enum.drop(bind, checkfirst=True)
    priority_level_enum.drop(bind, checkfirst=True)
