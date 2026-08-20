"""
app/services/orchestrator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Central Dispatcher — Routes media to the correct engine and
produces a unified VerificationResponse.

Routing logic:
  image/* → spatial_engine.analyze_image()
  audio/* → audio_engine.analyze_audio()
  video/* → temporal_engine.analyze_video()
  url      → phishing_engine.analyze_url()
  pdf      → phishing_engine.analyze_pdf() + metadata analysis
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog

from app.schemas.scan import ForensicFlag, VerificationResponse
from app.services.phishing_engine import (
    analyze_file_metadata,
    analyze_pdf,
    analyze_url,
)
from app.services.spatial_engine import analyze_image
from app.services.audio_engine import analyze_audio
from app.services.temporal_engine import analyze_video
from app.services.ensemble_engine import aggregate_scores
from app.services.explainer_service import generate_simple_summary

log = structlog.get_logger(__name__)

# MIME → (engine_type, media_type label)
MIME_ROUTE_MAP = {
    "image/jpeg": ("image", "image"),
    "image/png": ("image", "image"),
    "image/webp": ("image", "image"),
    "image/gif": ("image", "image"),
    "audio/wav": ("audio", "audio"),
    "audio/mpeg": ("audio", "audio"),
    "audio/mp3": ("audio", "audio"),
    "audio/mp4": ("audio", "audio"),
    "audio/m4a": ("audio", "audio"),
    "video/mp4": ("video", "video"),
    "video/quicktime": ("video", "video"),
    "video/avi": ("video", "video"),
    "application/pdf": ("pdf", "pdf"),
}


async def dispatch_file_scan(
    buffer: bytes,
    filename: str,
    mime_type: str,
    ext: str = "",
) -> VerificationResponse:
    """
    Dispatch a file buffer to the appropriate AI engine.

    Args:
        buffer:    Raw file bytes
        filename:  Original filename
        mime_type: Detected MIME type
        ext:       File extension (used for audio loading)

    Returns:
        VerificationResponse conforming to the frontend API contract
    """
    t_start = time.perf_counter()
    engine_type, media_type_label = MIME_ROUTE_MAP.get(mime_type.lower(), ("unknown", "image"))

    log.info("orchestrator.dispatch", filename=filename, mime=mime_type, engine=engine_type)

    # ── EXIF Metadata (for all image files) ──────────────────────────────────
    metadata_result = None
    if engine_type == "image":
        metadata_result = analyze_file_metadata(buffer, filename)

    # ── Engine Dispatch ───────────────────────────────────────────────────────
    if engine_type == "image":
        result = await analyze_image(buffer)
        if metadata_result and metadata_result.flags:
            result.flags.extend(metadata_result.flags)
            
        metadata_score = float(getattr(metadata_result, "confidence", 75.0 if (metadata_result and metadata_result.flags) else 10.0))
        final_score, weights = aggregate_scores(
            spatial_score=result.confidence,
            temporal_score=0.0,
            audio_score=0.0,
            metadata_score=metadata_score,
            channels=["image"]
        )
        
        if final_score >= 70:
            verdict = "DEEPFAKE_DETECTED"
        elif final_score >= 40:
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=final_score,
            media_type=media_type_label,
            filename=filename,
            flags=result.flags,
            heatmap_b64=result.heatmap_b64,
            heatmap_available=result.heatmap_available,
            engine_metadata={
                **result.engine_metadata,
                **(metadata_result.engine_metadata if metadata_result else {}),
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        )

    elif engine_type == "audio":
        audio_ext = ext or filename.rsplit(".", 1)[-1] if "." in filename else "wav"
        result = await analyze_audio(buffer, ext=audio_ext)
        final_score, weights = aggregate_scores(
            spatial_score=0.0,
            temporal_score=0.0,
            audio_score=result.confidence,
            metadata_score=0.0,
            channels=["audio"]
        )
        if final_score >= 65:
            verdict = "DEEPFAKE_DETECTED"
        elif final_score >= 35:
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=final_score,
            media_type=media_type_label,
            filename=filename,
            flags=result.flags,
            engine_metadata={
                **result.engine_metadata,
                **result.spectrogram_metadata,
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        )

    elif engine_type == "video":
        result = await analyze_video(buffer)
        spatial_score = result.engine_metadata.get("mean_frame_score", result.confidence)
        temporal_score = getattr(result, "rppg_anomaly_score", 0.0) * 100.0
        audio_score = getattr(result, "lip_sync_score", 0.0) * 100.0
        
        final_score, weights = aggregate_scores(
            spatial_score=spatial_score,
            temporal_score=temporal_score,
            audio_score=audio_score,
            metadata_score=0.0,
            channels=["video"]
        )
        if final_score >= 65:
            verdict = "DEEPFAKE_DETECTED"
        elif final_score >= 35:
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=final_score,
            media_type=media_type_label,
            filename=filename,
            flags=result.flags,
            engine_metadata={
                **result.engine_metadata,
                "ensemble_weights": weights,
                "rppg_waveform": getattr(result, "rppg_waveform", []),
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        )

    elif engine_type == "pdf":
        result = await analyze_pdf(buffer)
        metadata_result = analyze_file_metadata(buffer, filename)
        all_flags = result.flags + (metadata_result.flags if metadata_result else [])
        
        metadata_score = float(getattr(metadata_result, "confidence", 75.0 if (metadata_result and metadata_result.flags) else 10.0))
        final_score, weights = aggregate_scores(
            spatial_score=0.0,
            temporal_score=0.0,
            audio_score=0.0,
            metadata_score=(result.confidence + metadata_score) / 2.0,
            channels=["pdf"]
        )
        if final_score >= 65:
            verdict = "DEEPFAKE_DETECTED"
        elif final_score >= 35:
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=final_score,
            media_type=media_type_label,
            filename=filename,
            flags=all_flags,
            engine_metadata={
                **result.engine_metadata,
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        )

    else:
        log.warning("orchestrator.unknown_mime", mime=mime_type)
        return _build_response(
            verdict="SUSPICIOUS",
            confidence=50.0,
            media_type="image",
            filename=filename,
            flags=[ForensicFlag(
                label="Unsupported File Type",
                severity="medium",
                description=f"MIME type '{mime_type}' is not directly supported. Manual review recommended.",
            )],
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        )


async def dispatch_url_scan(url: str) -> VerificationResponse:
    """
    Dispatch a URL to the phishing engine.

    Args:
        url: URL string to analyse

    Returns:
        VerificationResponse with phishing verdict
    """
    t_start = time.perf_counter()
    result = await analyze_url(url)
    final_score, weights = aggregate_scores(
        spatial_score=0.0,
        temporal_score=0.0,
        audio_score=0.0,
        metadata_score=result.confidence,
        channels=["url"]
    )
    if final_score >= 65:
        verdict = "DEEPFAKE_DETECTED"
    elif final_score >= 35:
        verdict = "SUSPICIOUS"
    else:
        verdict = "AUTHENTIC"

    return _build_response(
        verdict=verdict,
        confidence=final_score,
        media_type="url",
        url=url,
        flags=result.flags,
        engine_metadata={
            **result.engine_metadata,
            "ensemble_weights": weights,
        },
        processing_time_ms=int((time.perf_counter() - t_start) * 1000),
        model_version="PhishGuard-v1.5",
    )


def _build_response(
    verdict: str,
    confidence: float,
    media_type: str,
    flags: list,
    processing_time_ms: int,
    filename: Optional[str] = None,
    url: Optional[str] = None,
    heatmap_b64: Optional[str] = None,
    heatmap_available: bool = False,
    engine_metadata: Optional[dict] = None,
    model_version: str = "DeepGuard-v3.1",
) -> VerificationResponse:
    """Build a standardised VerificationResponse."""
    meta = engine_metadata or {}
    simple_summary = generate_simple_summary(
        media_type=media_type,
        verdict=verdict,
        confidence=confidence,
        flags=flags,
        engine_metadata=meta,
    )
    return VerificationResponse(
        id=str(uuid.uuid4()),
        verdict=verdict,  # type: ignore[arg-type]
        confidence=round(confidence, 2),
        media_type=media_type,  # type: ignore[arg-type]
        filename=filename,
        url=url,
        flags=flags,
        heatmap_b64=heatmap_b64,
        heatmap_available=heatmap_available or (heatmap_b64 is not None),
        engine_metadata=meta,
        simple_summary=simple_summary,
        processing_time_ms=processing_time_ms,
        model_version=model_version,
        timestamp=datetime.now(timezone.utc),
    )
