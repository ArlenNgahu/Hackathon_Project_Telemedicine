"""
Bilingual (English / Kiswahili) notification templates + delivery.

Every notification is written to NotificationLog regardless of whether an
SMS provider is configured, so there's always an auditable record of what
was (or would have been) sent to a patient.

SAFETY NOTE: the Kiswahili templates below have not been clinically or
linguistically reviewed by a fluent speaker. Get them reviewed before
relying on them for real patient communication - see the equivalent note
in triage_service.py.
"""

from typing import Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.models.database import NotificationLog, Patient

# template_key -> {lang -> template string}. Templates use `.format(**context)`.
TEMPLATES: Dict[str, Dict[str, str]] = {
    "appointment_confirmed": {
        "en": "Hi {first_name}, your {appointment_type} appointment is confirmed for {scheduled_time}. Reply HELP for assistance.",
        "sw": "Habari {first_name}, miadi yako ya {appointment_type} imethibitishwa kwa {scheduled_time}. Jibu HELP kwa msaada.",
    },
    "appointment_reminder": {
        "en": "Reminder: you have a {appointment_type} appointment at {scheduled_time}.",
        "sw": "Kikumbusho: una miadi ya {appointment_type} saa {scheduled_time}.",
    },
    "triage_critical": {
        "en": "URGENT: based on your symptoms you should seek immediate hospital care. Help is being arranged.",
        "sw": "HARAKA: kutokana na dalili zako, unapaswa kupata huduma ya hospitali mara moja. Msaada unaandaliwa.",
    },
    "queue_teleconsult_offered": {
        "en": "Your wait time is longer than expected. A teleconsult is available now to avoid the wait - reply YES to accept.",
        "sw": "Muda wako wa kusubiri umezidi ulivyotarajiwa. Huduma ya mashauriano kwa simu/video ipo sasa - jibu YES kukubali.",
    },
    "caregiver_action_notice": {
        "en": "Your caregiver {caregiver_name} just performed an action on your account: {action_description}.",
        "sw": "Mlezi wako {caregiver_name} amefanya jambo kwenye akaunti yako: {action_description}.",
    },
}


def render_template(template_key: str, language: str, context: Dict) -> str:
    lang = language if language in ("en", "sw") else "en"
    templates = TEMPLATES.get(template_key)
    if not templates:
        raise ValueError(f"Unknown notification template: {template_key}")
    template = templates.get(lang, templates["en"])
    return template.format(**context)


async def send_notification(
    db: AsyncSession,
    patient: Patient,
    notification_type: str,
    template_key: str,
    context: Optional[Dict] = None,
    related_to: Optional[str] = None,
    related_id: Optional[str] = None,
) -> NotificationLog:
    """
    Render the appropriate-language template for `patient`, persist it to
    NotificationLog, and (if Twilio is configured and notification_type is
    "sms") attempt delivery. Delivery failures never raise - they're
    recorded on the log row so the caller's request still succeeds.
    """
    context = dict(context or {})
    context.setdefault("first_name", patient.first_name)

    message = render_template(template_key, patient.preferred_language, context)

    log = NotificationLog(
        patient_id=patient.id,
        notification_type=notification_type,
        recipient=patient.phone_primary if notification_type == "sms" else (patient.email or patient.phone_primary),
        message_content=message,
        message_template=template_key,
        status="pending",
        related_to=related_to,
        related_id=related_id,
    )
    db.add(log)
    await db.flush()  # assigns log.id / log.uuid default before we mutate status below

    if notification_type == "sms" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client  # imported lazily - optional dependency at runtime

            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            resp = client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=patient.phone_primary,
            )
            log.status = "sent"
            log.provider_response = str(resp.sid)
        except Exception as exc:  # noqa: BLE001 - third-party SDK, broad catch is intentional here
            log.status = "failed"
            log.provider_response = str(exc)
    else:
        # No provider configured (or non-SMS channel) - record as simulated
        # so audits can tell "we chose not to send" apart from "send failed".
        log.status = "simulated"

    await db.commit()
    await db.refresh(log)
    return log
