"""
app/db/models/scan_record.py — ScanRecord ORM Model
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, String, Text, JSON, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class ScanRecord(Base):
    __tablename__ = "scan_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    media_type: Mapped[str] = mapped_column(String(50), nullable=False)  # image, audio, video, pdf, url
    verdict: Mapped[str] = mapped_column(String(50), nullable=False)  # AUTHENTIC, SUSPICIOUS, SYNTHETIC_DEEPFAKE
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    heatmap_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    def __repr__(self) -> str:
        return f"<ScanRecord id={self.id} verdict={self.verdict} confidence_score={self.confidence_score:.1f}%>"
