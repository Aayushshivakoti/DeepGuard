from sqlalchemy import Column, Integer, String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class RetrainQueue(Base):
    __tablename__ = "retrain_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scan_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    media_path: Mapped[str] = mapped_column(String, nullable=False)
    initial_risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    admin_corrected_verdict: Mapped[str | None] = mapped_column(String, nullable=True)
    admin_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence_band: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "low", "medium", "high"
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
