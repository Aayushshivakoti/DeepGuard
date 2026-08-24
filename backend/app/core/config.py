"""
app/core/config.py — Centralised Settings via Pydantic BaseSettings
All configuration is read from environment variables / .env file.
"""
from __future__ import annotations

from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────────
    APP_NAME: str = "Deepfake & Phishing Media Verification Gateway"
    APP_ENV: str = "development"
    DEBUG: bool = True

    """
    # ── Security ───────────────────────────────────────────────────────────────
    SECRET_KEY: str = "insecure-dev-secret-change-in-production"
    JWT_SECRET: str = "CHANGE_ME_JWT_SECRET"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"
"""

    # ── Password Policy ────────────────────────────────────────────────────────
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_COMPLEXITY: bool = True

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./deepguard_db.sqlite"
    SYNC_DATABASE_URL: str = "sqlite:///./deepguard_db.sqlite"

    # ── Redis / Celery ─────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── File Upload ────────────────────────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 100

    ALLOWED_MIME_TYPES: str = (
        "image/jpeg,image/png,image/webp,"
        "audio/wav,audio/mpeg,audio/mp4,"
        "video/mp4,video/quicktime,"
        "application/pdf,"
        "message/rfc822"
    )

    @property
    def allowed_mime_set(self) -> set[str]:
        return set(self.ALLOWED_MIME_TYPES.split(","))

    # ── AI Models ─────────────────────────────────────────────────────────────
    MODEL_DEVICE: str = "cpu"
    SPATIAL_MODEL_PATH: str = "weights/efficientnet_b4_deepfake.pt"
    AUDIO_MODEL_PATH: str = "weights/voice_clone_detector.pt"
    TEXT_MODEL_PATH: str = "gpt2"
    USE_MOCK_MODELS: bool = True
    ONNX_QUANTIZATION_MODE: str = "none"  # none | fp16 | int8
    DEEPFAKE_CLASS_INDEX: int = 1  # Index of deepfake class in model output

    # ── Third-Party APIs ──────────────────────────────────────────────────────
    VIRUSTOTAL_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_KEY: str = ""

    # ── OAuth & WebAuthn SSO ──────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    MICROSOFT_CLIENT_ID: str = ""
    MICROSOFT_CLIENT_SECRET: str = ""
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "DeepGuard Gateway"
    WEBAUTHN_ORIGIN: str = "http://localhost:5173"

    # ── HMAC Secrets (for SIEM & Webhook signatures) ──────────────────────────
    SIEM_HMAC_SECRET: str = "DeepGuard-SIEM-HMAC-change-in-production"
    WEBHOOK_HMAC_SECRET: str = "DeepGuard-Webhook-Secret-change-in-production"

    # ── S3 / MinIO Object Storage ─────────────────────────────────────────────
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = "deepguard-uploads"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_REGION: str = "us-east-1"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:4173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


# Singleton settings instance
settings = Settings()
