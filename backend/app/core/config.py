"""
Core configuration settings for the telemedicine platform.
Uses Pydantic Settings for environment variable management.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """Application configuration."""

    # Application
    APP_NAME: str = "AfyaConnect - Accessible Telemedicine"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    # NOTE: uses the psycopg (v3) driver, which SQLAlchemy can run in both
    # sync and async mode from the same "postgresql+psycopg://" URL depending
    # on whether create_engine() or create_async_engine() is used. This keeps
    # us on the psycopg[binary] dependency already pinned in requirements.txt
    # instead of adding a second Postgres driver (asyncpg) for no reason.
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost/quadcare"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_QUEUE_DB: int = 1
    REDIS_CACHE_DB: int = 2

    # ChromaDB (Vector DB)
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"

    # External APIs
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    TWILIO_MESSAGING_SERVICE_SID: Optional[str] = None

    OPENAI_API_KEY: Optional[str] = None

    MPESA_CONSUMER_KEY: Optional[str] = None
    MPESA_CONSUMER_SECRET: Optional[str] = None
    MPESA_PASSKEY: Optional[str] = None
    MPESA_SHORTCODE: Optional[str] = None

    # AI/ML Models
    TRIAGE_MODEL_PATH: str = "./app/ml/models/triage_model.pkl"
    SYMPTOM_EXTRACTOR_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Voice/Speech
    TTS_LANGUAGE: str = "en"  # en, sw (Swahili)
    STT_ENGINE: str = "whisper"  # whisper, google
    VOICE_COMMAND_TIMEOUT: int = 10  # seconds

    # Queue System
    MAX_QUEUE_WAIT_MINUTES: int = 180  # 3 hours
    TELECONSULT_THRESHOLD_MINUTES: int = 45
    PRIORITY_PWD_BOOST: float = 0.3  # Priority boost for PWDs

    # Hospital Integration
    HOSPITAL_SLOTS_PER_HOUR: int = 4
    HOSPITAL_BUFFER_MINUTES: int = 15  # Buffer between appointments

    # Accessibility
    DEFAULT_FONT_SIZE: str = "large"  # normal, large, x-large
    HIGH_CONTRAST_DEFAULT: bool = True
    VOICE_INPUT_DEFAULT: bool = True
    CAREGIVER_NOTIFICATION_DEFAULT: bool = True

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_AUDIO_FORMATS: List[str] = ["wav", "mp3", "ogg", "m4a"]

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_PORT: int = 9090

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings."""
    return settings
