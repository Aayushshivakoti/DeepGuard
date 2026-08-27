"""
app/schemas/scan.py — Request / Response Pydantic Models for Scan Endpoints
All response schemas match the frontend's scanApi.js expectations exactly.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl


# ─── Forensic Flag ─────────────────────────────────────────────────────────────

class ForensicFlag(BaseModel):
    label: str = Field(..., description="Short human-readable flag name")
    severity: Literal["low", "medium", "high", "critical"] = Field(..., description="Severity level")
    description: str = Field(..., description="Detailed forensic explanation")


# ─── Verdict Types ─────────────────────────────────────────────────────────────

VerdictType = Literal[
    "AUTHENTIC",
    "SUSPICIOUS",
    "DEEPFAKE_DETECTED",
    "PHISHING_DETECTED",
]

MediaType = Literal["image", "audio", "video", "url", "pdf"]


# ─── Verification Response ─────────────────────────────────────────────────────

class VerificationResponse(BaseModel):
    """
    Unified response schema for all scan types.
    Matches the MOCK_RESULTS shape in frontend/src/api/scanApi.js.
    """
    id: str = Field(..., description="Unique scan result UUID")
    verdict: VerdictType = Field(..., description="Final forensic verdict")
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence percentage (0-100)")
    spatial_confidence: Optional[float] = Field(None, ge=0.0, le=100.0, description="Spatial RGB model confidence")
    frequency_artifact_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Frequency domain artifact score")
    overall_verdict: Optional[VerdictType] = Field(None, description="Final verdict after thresholds")
    media_type: MediaType = Field(..., description="Type of scanned media")

    # ── Identifiers ────────────────────────────────────────────────────────────
    filename: Optional[str] = Field(None, description="Original file name (for file scans)")
    url: Optional[str] = Field(None, description="Scanned URL (for URL scans)")

    # ── Forensic Detail ───────────────────────────────────────────────────────
    flags: List[ForensicFlag] = Field(default_factory=list, description="Forensic evidence flags")
    heatmap_b64: Optional[str] = Field(None, description="Base64-encoded PNG Grad-CAM heatmap")
    heatmap_available: bool = Field(default=False, description="Whether a heatmap was generated")
    explainability_data: Optional[str] = Field(None, description="Base64-encoded XAI data (e.g., JSON summary)")

    # ── Engine Metadata & XAI Summary ─────────────────────────────────────────
    engine_metadata: Optional[dict] = Field(None, description="Per-engine raw analysis metadata")
    simple_summary: Optional[dict] = Field(None, description="Plain-language Explainable AI summary")

    # ── Enterprise Analytics ──────────────────────────────────────────────────
    phash_cache_hit: bool = Field(default=False, description="pHash Cache Hit flag")
    saved_gpu_execution: bool = Field(default=False, description="Indicates if GPU execution was skipped due to cache hit")
    phash_similarity: Optional[float] = Field(default=None, description="Similarity score of the cache hit")
    sandbox_status: Optional[str] = Field(default=None, description="Malicious download payload sandbox status")
    detected_payload_type: Optional[str] = Field(default=None, description="File type of payload detected")

    # ── Performance ───────────────────────────────────────────────────────────
    processing_time_ms: int = Field(..., description="Total processing time in milliseconds")
    model_version: str = Field(default="DeepGuard-v3.1", description="Model version used")

    # ── Timestamp ─────────────────────────────────────────────────────────────
    timestamp: datetime = Field(..., description="ISO-8601 timestamp of scan completion")

    class Config:
        from_attributes = True


# ─── File Scan Request ─────────────────────────────────────────────────────────

class FileScanRequest(BaseModel):
    """Optional metadata accompanying a file upload (sent as form field)."""
    media_type: Optional[MediaType] = Field(None, description="Override media type detection")


# ─── URL Scan Request ─────────────────────────────────────────────────────────

class UrlScanRequest(BaseModel):
    """Request body for URL phishing analysis."""
    url: str = Field(..., description="URL to scan for phishing indicators")


# ─── Scan History Item ────────────────────────────────────────────────────────

class ScanHistoryItem(BaseModel):
    id: str
    filename: Optional[str] = None
    url: Optional[str] = None
    media_type: MediaType
    verdict: VerdictType
    confidence: float
    timestamp: datetime

    class Config:
        from_attributes = True
