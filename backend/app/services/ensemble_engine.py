"""
app/services/ensemble_engine.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Weighted Multi-Modal Ensemble Aggregator with Preset Profiles

Dynamically normalizes and computes deepfake risk scores depending on
available media channels and selected preset profile:
  - STRICT_IDENTITY: 40% Audio, 40% Spatial, 10% Temporal, 10% Metadata
  - SOCIAL_LEAK:     35% Spatial, 35% Temporal, 20% Audio, 10% Metadata
  - DOCUMENT_FRAUD:  50% Metadata, 40% Spatial, 10% Frequency/Temporal
  - BALANCED:        35% Spatial, 25% Temporal, 25% Audio, 15% Metadata
"""
from typing import List, Dict, Tuple, Optional
import structlog

log = structlog.get_logger(__name__)

PRESET_PROFILES = {
    "STRICT_IDENTITY": {"spatial": 0.40, "audio": 0.40, "temporal": 0.10, "metadata": 0.10},
    "SOCIAL_LEAK":     {"spatial": 0.35, "temporal": 0.35, "audio": 0.20, "metadata": 0.10},
    "DOCUMENT_FRAUD":  {"metadata": 0.50, "spatial": 0.40, "temporal": 0.10, "audio": 0.00},
    "BALANCED":        {"spatial": 0.35, "temporal": 0.25, "audio": 0.25, "metadata": 0.15},
}

def aggregate_scores(
    spatial_score: float,
    temporal_score: float,
    audio_score: float,
    metadata_score: float,
    channels: List[str],
    preset_profile: str = "BALANCED",
    custom_weights: Optional[Dict[str, float]] = None,
    gemini_score: Optional[float] = None,
    zerogpt_score: Optional[float] = None,
    huggingface_score: Optional[float] = None,
) -> Tuple[float, Dict[str, float]]:
    """
    Compute context-aware weighted aggregate risk score.
    Supports preset profiles, custom weight maps, and dynamic blending of external APIs
    (Google Gemini, ZeroGPT, Hugging Face).
    """
    if custom_weights and isinstance(custom_weights, dict) and sum(custom_weights.values()) > 0:
        base_weights = {
            "spatial": float(custom_weights.get("spatial", 0.25)),
            "temporal": float(custom_weights.get("temporal", 0.25)),
            "audio": float(custom_weights.get("audio", 0.25)),
            "metadata": float(custom_weights.get("metadata", 0.25)),
            "gemini": float(custom_weights.get("gemini", 0.20)),
            "zerogpt": float(custom_weights.get("zerogpt", 0.15)),
            "huggingface": float(custom_weights.get("huggingface", 0.15)),
        }
    else:
        profile_key = preset_profile.upper() if preset_profile else "BALANCED"
        base_weights = PRESET_PROFILES.get(profile_key, PRESET_PROFILES["BALANCED"]).copy()
        base_weights.update({"gemini": 0.25, "zerogpt": 0.20, "huggingface": 0.20})

    active_weights = {}

    is_video = "video" in channels
    is_image = "image" in channels
    is_audio = "audio" in channels
    is_pdf = "pdf" in channels
    is_url = "url" in channels
    is_text = "text" in channels

    # Determine feature activity for local engines
    active_weights["spatial"] = base_weights["spatial"] if (is_image or is_video) else 0.0
    active_weights["temporal"] = base_weights["temporal"] if is_video else 0.0
    active_weights["audio"] = base_weights["audio"] if (is_audio or is_video) else 0.0
    active_weights["metadata"] = base_weights["metadata"] if (is_pdf or is_url or is_image or is_text) else 0.0

    # Determine feature activity for external APIs
    import math
    if gemini_score is not None and not math.isnan(gemini_score) and not math.isinf(gemini_score):
        active_weights["gemini"] = base_weights.get("gemini", 0.25)
    if zerogpt_score is not None and not math.isnan(zerogpt_score) and not math.isinf(zerogpt_score):
        active_weights["zerogpt"] = base_weights.get("zerogpt", 0.20)
    if huggingface_score is not None and not math.isnan(huggingface_score) and not math.isinf(huggingface_score):
        active_weights["huggingface"] = base_weights.get("huggingface", 0.20)

    total_weight = sum(active_weights.values())
    if total_weight > 0.0:
        normalized_weights = {k: round(v / total_weight, 4) for k, v in active_weights.items()}
    else:
        normalized_weights = {"spatial": 1.0}

    # Sanitize NaN/Inf inputs
    spatial_score = 0.0 if (math.isnan(spatial_score) or math.isinf(spatial_score)) else spatial_score
    temporal_score = 0.0 if (math.isnan(temporal_score) or math.isinf(temporal_score)) else temporal_score
    audio_score = 0.0 if (math.isnan(audio_score) or math.isinf(audio_score)) else audio_score
    metadata_score = 0.0 if (math.isnan(metadata_score) or math.isinf(metadata_score)) else metadata_score

    # Compute base risk score from active channels
    risk_score = (
        normalized_weights.get("spatial", 0.0) * spatial_score +
        normalized_weights.get("temporal", 0.0) * temporal_score +
        normalized_weights.get("audio", 0.0) * audio_score +
        normalized_weights.get("metadata", 0.0) * metadata_score
    )

    if "gemini" in normalized_weights and gemini_score is not None:
        risk_score += normalized_weights["gemini"] * gemini_score
    if "zerogpt" in normalized_weights and zerogpt_score is not None:
        risk_score += normalized_weights["zerogpt"] * zerogpt_score
    if "huggingface" in normalized_weights and huggingface_score is not None:
        risk_score += normalized_weights["huggingface"] * huggingface_score

    risk_score = min(max(risk_score, 0.0), 100.0)

    # High-confidence override for document/text channels:
    # If ZeroGPT or Gemini detects high AI probability (>=80%), override low structural scores to prevent false authentic verdicts
    if (is_pdf or is_text):
        if zerogpt_score is not None and zerogpt_score >= 80.0:
            risk_score = max(risk_score, zerogpt_score)
        if gemini_score is not None and gemini_score >= 80.0:
            risk_score = max(risk_score, gemini_score)

    log.info(
        "ensemble.aggregated",
        channels=channels,
        preset=preset_profile,
        weights=normalized_weights,
        final_score=risk_score
    )

    return float(risk_score), normalized_weights
