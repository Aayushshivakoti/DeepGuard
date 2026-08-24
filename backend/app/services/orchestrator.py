"""
app/services/orchestrator.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Central Dispatcher — Routes media to the correct engine and
produces a unified VerificationResponse.

Integrates real ML models:
  - Vision model (EfficientNet-B4 + Grad-CAM + GAN fingerprint)
  - Audio model (ASVspoof 1D CNN voice-clone detection)
  - Text detector (GPTZero-style perplexity check)
  - Email parser (.eml forensics)
  - PDF forensics (embedded JS/forgery detection)
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import structlog
import anyio

from app.schemas.scan import ForensicFlag, VerificationResponse, VerdictType
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

# Import real models
from app.ml_models import (
    get_vision_model,
    get_audio_model,
    get_text_detector,
    get_gan_fingerprinter,
    get_cross_modal_checker,
)
from app.services.email_parser_service import analyze_email
from app.services.pdf_forensic_service import analyze_pdf_forensics

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
    "message/rfc822": ("email", "pdf"),
    "text/plain": ("text", "pdf"),
}


async def dispatch_file_scan(
    buffer: bytes,
    filename: str,
    mime_type: str,
    ext: str = "",
) -> VerificationResponse:
    """
    Dispatch a file buffer to the appropriate AI engine.
    """
    t_start = time.perf_counter()
    engine_type, media_type_label = MIME_ROUTE_MAP.get(mime_type.lower(), ("unknown", "image"))

    log.info("orchestrator.dispatch", filename=filename, mime=mime_type, engine=engine_type)

    # ── EXIF Metadata (for all image files) ──────────────────────────────────
    metadata_result = None
    if engine_type == "image":
        metadata_result = await anyio.to_thread.run_sync(analyze_file_metadata, buffer, filename)

    # ── Engine Dispatch ───────────────────────────────────────────────────────
    if engine_type == "image":
        # 1. Spatial engine analyze
        result = await analyze_image(buffer)
        
        # 2. Run real vision deepfake model predict
        vision_model = get_vision_model()
        model_prob, _ = await anyio.to_thread.run_sync(vision_model.predict, buffer)
        
        # Generates Grad-CAM heatmap if available
        heatmap_b64 = await anyio.to_thread.run_sync(vision_model.generate_gradcam, buffer)
        heatmap_available = heatmap_b64 is not None
        if not heatmap_b64:
            heatmap_b64 = result.heatmap_b64
            heatmap_available = result.heatmap_available

        # 3. Run GAN fingerprint analysis
        gan_result = await anyio.to_thread.run_sync(get_gan_fingerprinter().analyze, buffer)
        if gan_result.get("is_synthetic"):
            result.flags.append(ForensicFlag(
                label="GAN Fingerprint Match",
                severity="high",
                description=f"Spectral signatures match known GAN/Diffusion generator: {gan_result['probable_model']}.",
            ))

        if metadata_result and metadata_result.flags:
            result.flags.extend(metadata_result.flags)
            
        metadata_score = float(getattr(metadata_result, "confidence", 75.0 if (metadata_result and metadata_result.flags) else 10.0))
        
        # Aggregate scores (ensemble: heuristic, real ML model probability, metadata)
        combined_vision_score = (result.confidence + model_prob) / 2.0
        
        final_score, weights = aggregate_scores(
            spatial_score=combined_vision_score,
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
            heatmap_b64=heatmap_b64,
            heatmap_available=heatmap_available,
            engine_metadata={
                **result.engine_metadata,
                **(metadata_result.engine_metadata if metadata_result else {}),
                "gan_fingerprint": gan_result,
                "vision_model_probability": round(model_prob, 2),
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=result.confidence,
            frequency_artifact_score=None,
            overall_verdict=verdict,
        )

    elif engine_type == "audio":
        audio_ext = ext or filename.rsplit(".", 1)[-1] if "." in filename else "wav"
        result = await analyze_audio(buffer, ext=audio_ext)
        
        # Run real voice clone detector
        audio_model = get_audio_model()
        model_prob, _ = await anyio.to_thread.run_sync(audio_model.predict, buffer, audio_ext)

        final_score, weights = aggregate_scores(
            spatial_score=0.0,
            temporal_score=0.0,
            audio_score=(result.confidence + model_prob) / 2.0,
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
                "voice_clone_probability": round(model_prob, 2),
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict=verdict,
        )

    elif engine_type == "video":
        result = await analyze_video(buffer)
        spatial_score = result.engine_metadata.get("mean_frame_score", result.confidence)
        temporal_score = getattr(result, "rppg_anomaly_score", 0.0) * 100.0
        audio_score = getattr(result, "lip_sync_score", 0.0) * 100.0
        
        # Audio-visual consistency checker
        cross_modal = get_cross_modal_checker()
        # Simulated/cached audio extracted from video
        cross_modal_res = await anyio.to_thread.run_sync(cross_modal.analyze, [], buffer, "wav")
        if cross_modal_res.get("is_suspicious"):
            result.flags.append(ForensicFlag(
                label="Audio-Visual Desynced Emotion",
                severity="high",
                description=cross_modal_res["explanation"],
            ))

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
                "cross_modal_consistency": cross_modal_res,
                "ensemble_weights": weights,
                "rppg_waveform": getattr(result, "rppg_waveform", []),
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict=verdict,
        )

    elif engine_type == "pdf":
        result = await analyze_pdf(buffer)
        metadata_result = await anyio.to_thread.run_sync(analyze_file_metadata, buffer, filename)
        
        # Advanced PDF Forgeries check
        pdf_forensics = await anyio.to_thread.run_sync(analyze_pdf_forensics, buffer)
        
        all_flags = result.flags + (metadata_result.flags if metadata_result else [])
        for finding in pdf_forensics.get("findings", []):
            all_flags.append(ForensicFlag(
                label=finding["category"].replace("_", " ").title(),
                severity=finding["severity"],
                description=finding["description"],
            ))

        metadata_score = float(getattr(metadata_result, "confidence", 75.0 if (metadata_result and metadata_result.flags) else 10.0))
        combined_pdf_score = (result.confidence + metadata_score + pdf_forensics["forgery_score"]) / 3.0

        final_score, weights = aggregate_scores(
            spatial_score=0.0,
            temporal_score=0.0,
            audio_score=0.0,
            metadata_score=combined_pdf_score,
            channels=["pdf"]
        )
        if final_score >= 65:
            verdict = "PHISHING_DETECTED"
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
                "pdf_forensics": pdf_forensics,
                "ensemble_weights": weights,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict=verdict,
        )

    elif engine_type == "email":
        # Run email analysis
        email_res = await anyio.to_thread.run_sync(analyze_email, buffer)
        
        all_flags = []
        for finding in email_res.get("findings", []):
            all_flags.append(ForensicFlag(
                label=finding["category"].replace("_", " ").title(),
                severity=finding["severity"],
                description=finding["description"],
            ))

        verdict_str = email_res.get("verdict", "AUTHENTIC")
        if verdict_str == "PHISHING_DETECTED":
            verdict = "PHISHING_DETECTED"
        elif verdict_str == "SUSPICIOUS":
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=email_res["phishing_score"],
            media_type="pdf",  # Document/PDF group in frontend
            filename=filename,
            flags=all_flags,
            engine_metadata={
                "email_analysis": email_res,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict=verdict,
        )

    elif engine_type == "text":
        # Run AI text detector
        text_str = buffer.decode("utf-8", errors="replace")
        text_res = await anyio.to_thread.run_sync(get_text_detector().analyze, text_str)
        
        flags = []
        if text_res["verdict"] == "LIKELY_AI":
            flags.append(ForensicFlag(
                label="AI Generated Text",
                severity="high",
                description=text_res["explanation"],
            ))
            verdict = "DEEPFAKE_DETECTED"
        elif text_res["verdict"] == "MIXED":
            flags.append(ForensicFlag(
                label="Mixed Text Style",
                severity="medium",
                description=text_res["explanation"],
            ))
            verdict = "SUSPICIOUS"
        else:
            verdict = "AUTHENTIC"

        return _build_response(
            verdict=verdict,
            confidence=text_res["ai_probability"],
            media_type="pdf",  # Map to Document section
            filename=filename,
            flags=flags,
            engine_metadata={
                "text_detector": text_res,
            },
            processing_time_ms=int((time.perf_counter() - t_start) * 1000),
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict=verdict,
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
            spatial_confidence=None,
            frequency_artifact_score=None,
            overall_verdict="SUSPICIOUS",
        )


async def dispatch_url_scan(url: str) -> VerificationResponse:
    """
    Dispatch a URL to the phishing engine.
    """
    t_start = time.perf_counter()
    result = await analyze_url(url)
    
    # Check extra third-party integrations (VirusTotal / Safe Browsing)
    from app.services.virustotal_service import scan_url_virustotal
    from app.services.safe_browsing_service import check_safe_browsing

    vt_res = await scan_url_virustotal(url)
    gsb_res = await check_safe_browsing(url)

    if vt_res and vt_res.get("malicious_count", 0) > 0:
        result.flags.append(ForensicFlag(
            label="VirusTotal Threat Warning",
            severity="critical",
            description=f"URL flagged as malicious by {vt_res['malicious_count']} engine(s) on VirusTotal.",
        ))

    if gsb_res and not gsb_res.get("is_safe", True):
        result.flags.append(ForensicFlag(
            label="Google Safe Browsing Warning",
            severity="critical",
            description=f"Google Safe Browsing reported security match: {', '.join(gsb_res['threat_types'])}.",
        ))

    # Re-calculate confidence with live threat scores
    final_score = result.confidence
    if vt_res and "threat_score" in vt_res:
        final_score = (final_score + vt_res["threat_score"]) / 2.0
    if gsb_res and "threat_score" in gsb_res:
        final_score = max(final_score, gsb_res["threat_score"])

    final_score, weights = aggregate_scores(
        spatial_score=0.0,
        temporal_score=0.0,
        audio_score=0.0,
        metadata_score=final_score,
        channels=["url"]
    )
    if final_score >= 65:
        verdict = "PHISHING_DETECTED"
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
            "virustotal": vt_res,
            "safe_browsing": gsb_res,
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
    spatial_confidence: Optional[float] = None,
    frequency_artifact_score: Optional[float] = None,
    overall_verdict: Optional[VerdictType] = None,
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
        spatial_confidence=spatial_confidence,
        frequency_artifact_score=frequency_artifact_score,
        overall_verdict=overall_verdict if overall_verdict is not None else verdict,
        timestamp=datetime.now(timezone.utc),
    )
