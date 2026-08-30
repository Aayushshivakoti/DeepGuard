# backend/app/services/cross_modal.py
"""
Cross-Modal Audio-Visual Synchronization Engine
Evaluates timestamp alignment between audio vocal energy envelopes
and visual mouth openness variations to identify deepfake desync anomalies.
"""
from __future__ import annotations
import os
import tempfile
import cv2
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
import structlog

log = structlog.get_logger(__name__)

# Try optional librosa import
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False

_face_cascade = None

def _get_face_cascade() -> cv2.CascadeClassifier:
    global _face_cascade
    if _face_cascade is None:
        import cv2
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade

def _extract_mouth_openness(frame_bgr: np.ndarray) -> float:
    """
    Measure mouth openness by locating the mouth ROI and calculating the ratio
    of dark pixels (oral cavity).
    """
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    cascade = _get_face_cascade()
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
    if len(faces) == 0:
        return 0.0

    x, y, w, h = faces[0]
    # Mouth is approximately lower 35% height, middle 60% width
    mouth_y = y + int(h * 0.65)
    mouth_h = int(h * 0.3)
    mouth_x = x + int(w * 0.2)
    mouth_w = int(w * 0.6)

    mouth_roi = gray[mouth_y : mouth_y + mouth_h, mouth_x : mouth_x + mouth_w]
    if mouth_roi.size == 0:
        return 0.0

    # Open mouth exhibits dark pixels inside the cavity
    # Normalize ROI illumination first
    norm_roi = cv2.equalizeHist(mouth_roi)
    dark_pixels = np.sum(norm_roi < 45)
    openness = float(dark_pixels) / float(mouth_roi.size)
    return openness

def check_audio_visual_sync(
    frames_bgr: List[np.ndarray],
    video_bytes: bytes,
    fps: float = 25.0
) -> Tuple[float, float, str]:
    """
    Check the temporal synchronization between mouth movement and audio vocalization.
    
    Returns:
      (mismatch_score 0.0 - 100.0, correlation_value, description)
    """
    if len(frames_bgr) < 5 or not LIBROSA_AVAILABLE:
        return 0.0, 0.5, "Cross-modal sync skipped: insufficient frames or librosa unavailable."

    # 1. Extract visual mouth openness series
    visual_openness = []
    for frame in frames_bgr:
        visual_openness.append(_extract_mouth_openness(frame))

    # 2. Extract audio track energy envelope
    audio_energy = []
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        try:
            # Load audio track from the video file path
            y, sr = librosa.load(tmp_path, sr=16000, mono=True, duration=30)
            rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=256)[0]
            audio_energy = rms.tolist()
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except Exception as exc:
        log.warning("cross_modal.audio_extract_failed", error=str(exc))
        return 0.0, 0.5, f"Cross-modal sync failed to extract audio: {exc}"

    if not audio_energy or len(audio_energy) < 5:
        return 0.0, 0.5, "No audio speech envelope detected in media file."

    # Resample sequences to match dimensions
    target_len = min(len(visual_openness), len(audio_energy), 100)
    vis_resampled = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(visual_openness)), visual_openness)
    aud_resampled = np.interp(np.linspace(0, 1, target_len), np.linspace(0, 1, len(audio_energy)), audio_energy)

    # Compute correlation
    corr = np.corrcoef(vis_resampled, aud_resampled)[0, 1]
    if np.isnan(corr):
        corr = 0.5

    # 3. Analyze specific desync mismatch behaviors
    # Mismatch 1: Voice peaks occur while lips are static (low variance)
    vocal_active = aud_resampled > 0.03
    lip_static = np.std(vis_resampled) < 0.03

    mismatch_1_count = np.sum(vocal_active & (vis_resampled < 0.05))
    mismatch_1_ratio = float(mismatch_1_count) / float(target_len)

    # Calculate mismatch penalty score
    mismatch_score = (1.0 - corr) * 50.0  # Up to 50 based on correlation desync
    if mismatch_1_ratio > 0.25:
        mismatch_score += 35.0  # High penalty for talking with closed lips
    
    mismatch_score = min(max(mismatch_score, 0.0), 100.0)

    if mismatch_score > 60.0:
        desc = f"Lip desync detected: vocal speech matches static lip boundaries (ratio: {mismatch_1_ratio:.2f}, corr: {corr:.2f})."
    else:
        desc = f"Mouth movement matches audio vocalization envelope successfully (corr: {corr:.2f})."

    return mismatch_score, corr, desc
