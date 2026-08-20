"""
app/db/models/scan_result.py — ScanResult ORM Model
Stores the full forensic analysis record for every media scan.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, JSON, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )

    # ── Identity ───────────────────────────────────────────────────────────────
    filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    media_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # e.g.: image | audio | video | url | pdf

    # ── Verdict ────────────────────────────────────────────────────────────────
    verdict: Mapped[str] = mapped_column(String(50), nullable=False)
    # AUTHENTIC | SUSPICIOUS | DEEPFAKE_DETECTED | PHISHING_DETECTED

    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 0.0 – 100.0

    # ── Forensic Detail ───────────────────────────────────────────────────────
    forensic_flags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Array of {label, severity, description}

    engine_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Per-engine raw metadata dict

    heatmap_b64: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Base64-encoded PNG heatmap for image/video scans

    # ── Performance ───────────────────────────────────────────────────────────
    processing_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="DeepGuard-v3.1")

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<ScanResult id={self.id} verdict={self.verdict} confidence={self.confidence:.1f}%>"
