"""
app/schemas/admin.py — Pydantic Models for Admin / Analytics Endpoints
Matches frontend MOCK_ADMIN_METRICS and MOCK_ALERT_FEED shapes.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ─── Weekly Threat Data ───────────────────────────────────────────────────────

class WeeklyThreat(BaseModel):
    day: str
    deepfakes: int
    phishing: int
    authentic: int


# ─── Media Distribution ───────────────────────────────────────────────────────

class MediaDistribution(BaseModel):
    name: str
    value: int
    color: str


# ─── Borderline Case ──────────────────────────────────────────────────────────

class BorderlineCase(BaseModel):
    id: str
    filename: Optional[str] = None
    url: Optional[str] = None
    media_type: str
    confidence: float
    timestamp: datetime
    status: Literal["pending", "confirmed", "cleared"]


# ─── Metrics Response ─────────────────────────────────────────────────────────

class MetricsResponse(BaseModel):
    """
    Response for GET /admin/metrics.
    Matches MOCK_ADMIN_METRICS in scanApi.js.
    """
    total_scanned: int = Field(..., description="Total scans processed")
    deepfakes_flagged: int = Field(..., description="Deepfakes detected count")
    phishing_blocked: int = Field(..., description="Phishing URLs blocked count")
    avg_latency_ms: float = Field(..., description="Average processing latency in ms")
    weekly_threats: List[WeeklyThreat] = Field(default_factory=list)
    media_distribution: List[MediaDistribution] = Field(default_factory=list)
    borderline_cases: List[BorderlineCase] = Field(default_factory=list)


# ─── Alert Item ───────────────────────────────────────────────────────────────

class AlertItem(BaseModel):
    """
    Single item in the live threat alert feed.
    Matches MOCK_ALERT_FEED in scanApi.js.
    """
    id: str
    severity: Literal["low", "medium", "high", "critical"]
    message: str
    media_type: str
    timestamp: datetime


# ─── Analytics Response ───────────────────────────────────────────────────────

class VerdictDistribution(BaseModel):
    verdict: str
    count: int
    percentage: float


class DailyStats(BaseModel):
    date: str
    total: int
    deepfakes: int
    phishing: int
    authentic: int
    suspicious: int


class AnalyticsResponse(BaseModel):
    """Response for GET /admin/analytics — full dashboard data."""
    total_scanned: int
    deepfakes_flagged: int
    phishing_blocked: int
    authentic_count: int
    suspicious_count: int
    avg_confidence: float
    avg_latency_ms: float
    verdict_distribution: List[VerdictDistribution]
    daily_stats: List[DailyStats]
    media_distribution: List[MediaDistribution]
    top_threat_flags: List[dict]


# ─── Audit Log Entry ──────────────────────────────────────────────────────────

class AuditLogEntry(BaseModel):
    id: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    metadata: Optional[dict] = None
    ip_address: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
