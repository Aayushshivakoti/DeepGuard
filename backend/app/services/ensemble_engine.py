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
    custom_weights: Optional[Dict[str, float]] = None
) -> Tuple[float, Dict[str, float]]:
    """
    Compute context-aware weighted aggregate risk score.
    Supports preset profiles or user-specified custom weight maps.
    """
    if custom_weights and isinstance(custom_weights, dict) and sum(custom_weights.values()) > 0:
        base_weights = {
            "spatial": float(custom_weights.get("spatial", 0.25)),
            "temporal": float(custom_weights.get("temporal", 0.25)),
            "audio": float(custom_weights.get("audio", 0.25)),
            "metadata": float(custom_weights.get("metadata", 0.25)),
        }
    else:
        profile_key = preset_profile.upper() if preset_profile else "BALANCED"
        base_weights = PRESET_PROFILES.get(profile_key, PRESET_PROFILES["BALANCED"]).copy()

    active_weights = {}

    is_video = "video" in channels
    is_image = "image" in channels
    is_audio = "audio" in channels
    is_pdf = "pdf" in channels
    is_url = "url" in channels

    # Determine feature activity
    active_weights["spatial"] = base_weights["spatial"] if (is_image or is_video) else 0.0
    active_weights["temporal"] = base_weights["temporal"] if is_video else 0.0
    active_weights["audio"] = base_weights["audio"] if (is_audio or is_video) else 0.0
    active_weights["metadata"] = base_weights["metadata"] if (is_pdf or is_url or is_image) else 0.0

    total_weight = sum(active_weights.values())
    if total_weight > 0.0:
        normalized_weights = {k: round(v / total_weight, 4) for k, v in active_weights.items()}
    else:
        normalized_weights = {"spatial": 1.0, "temporal": 0.0, "audio": 0.0, "metadata": 0.0}

    risk_score = (
        normalized_weights.get("spatial", 0.0) * spatial_score +
        normalized_weights.get("temporal", 0.0) * temporal_score +
        normalized_weights.get("audio", 0.0) * audio_score +
        normalized_weights.get("metadata", 0.0) * metadata_score
    )

    risk_score = min(max(risk_score, 0.0), 100.0)

    log.info(
        "ensemble.aggregated",
        channels=channels,
        preset=preset_profile,
        weights=normalized_weights,
        final_score=risk_score
    )

    return float(risk_score), normalized_weights
