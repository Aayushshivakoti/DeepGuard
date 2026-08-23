"""
app/db/models/user.py — User ORM Model
Extended with soft-delete, OAuth provider tracking, tier, and password audit fields.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="USER")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── OAuth & SSO ────────────────────────────────────────────────────────────
    oauth_provider: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="OAuth provider: google, github, microsoft, or null for email/password",
    )

    # ── Tier / Quota ──────────────────────────────────────────────────────────
    tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default="FREE",
        comment="Subscription tier: FREE, PRO, ENTERPRISE",
    )

    # ── Password Audit ────────────────────────────────────────────────────────
    password_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── GDPR Soft-Delete ──────────────────────────────────────────────────────
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
        comment="Soft-delete timestamp for GDPR compliance. Non-null = deleted.",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
