"""
app/db/models/audit_log.py — AuditLog ORM Model
Stores immutable records of all administrative and API actions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # ── Action Context ─────────────────────────────────────────────────────────
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # e.g.: SCAN_FILE, SCAN_URL, USER_LOGIN, ADMIN_VIEW_ANALYTICS

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # e.g.: scan_result, user

    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # UUID string of the related entity

    # ── Payload ────────────────────────────────────────────────────────────────
    action_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    # Arbitrary structured context for the action

    # ── Request Context ───────────────────────────────────────────────────────
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ── Timestamp ─────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} at={self.created_at}>"
