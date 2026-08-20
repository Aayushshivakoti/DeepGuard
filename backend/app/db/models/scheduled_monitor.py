"""
app/db/models/scheduled_monitor.py — Scheduled Monitor ORM Model
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Float, DateTime, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class ScheduledMonitor(Base):
    __tablename__ = "scheduled_monitors"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)
    url_or_domain: Mapped[str] = mapped_column(String(500), nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), default="DAILY") # DAILY | WEEKLY | HOURLY
    target_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")
    last_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    last_verdict: Mapped[str] = mapped_column(String(50), default="AUTHENTIC")
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
