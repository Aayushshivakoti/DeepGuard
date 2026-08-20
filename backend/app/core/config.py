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

    # ── Security ───────────────────────────────────────────────────────────────
    SECRET_KEY: str = "insecure-dev-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_ALGORITHM: str = "HS256"

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
        "application/pdf"
    )

    @property
    def allowed_mime_set(self) -> set[str]:
        return set(self.ALLOWED_MIME_TYPES.split(","))

    # ── AI Models ─────────────────────────────────────────────────────────────
    MODEL_DEVICE: str = "cpu"
    SPATIAL_MODEL_PATH: str = "weights/efficientnet_b4_deepfake.pt"
    AUDIO_MODEL_PATH: str = "weights/voice_clone_detector.pt"
    USE_MOCK_MODELS: bool = True

    # ── Third-Party APIs ──────────────────────────────────────────────────────
    VIRUSTOTAL_API_KEY: str = ""
    GOOGLE_SAFE_BROWSING_KEY: str = ""

    # ── OAuth & WebAuthn SSO ──────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "DeepGuard Gateway"
    WEBAUTHN_ORIGIN: str = "http://localhost:5173"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:4173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


# Singleton settings instance
settings = Settings()
