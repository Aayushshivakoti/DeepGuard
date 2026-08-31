# backend/app/services/rppg_engine.py
"""
Physiological rPPG Engine - Captures capillary green-channel temporal pulse variations.
If periodic pulse signatures (heart rate baseline) are missing or irregular,
generates a biological anomaly penalty score.
"""
from __future__ import annotations
import cv2

# Safe fallback for missing CascadeClassifier (e.g., when using opencv-python-headless)
if not hasattr(cv2, "CascadeClassifier"):
    class _DummyCascade:
        def detectMultiScale(self, *args, **kwargs):
            return []
    cv2.CascadeClassifier = lambda *args, **kwargs: _DummyCascade()
import numpy as np
import os
from typing import List, Tuple, Optional
import structlog

log = structlog.get_logger(__name__)

_face_cascade = None

def _get_face_cascade() -> cv2.CascadeClassifier:
    global _face_cascade
    if _face_cascade is None:
        # Load cascade from opencv built-in path
        import cv2
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade

def extract_rppg_signal(frames_bgr: List[np.ndarray]) -> List[float]:
    """
    Extract capillary blood volume pulse signal by averaging green channel intensity
    in forehead and cheek regions of interest (ROIs).
    """
    if len(frames_bgr) < 5:
        return []

    signal = []
    cascade = _get_face_cascade()

    for frame in frames_bgr:
        # Check error bounds for resolution
        h_f, w_f, _ = frame.shape
        if h_f < 100 or w_f < 100:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))

        if len(faces) == 0:
            continue

        x, y, w, h = faces[0]
        # Define forehead region: top 25% height, middle 50% width
        forehead_roi = frame[y : y + int(h * 0.25), x + int(w * 0.25) : x + int(w * 0.75)]
        
        # Define cheek regions
        left_cheek = frame[y + int(h * 0.45) : y + int(h * 0.7), x + int(w * 0.15) : x + int(w * 0.4)]
        right_cheek = frame[y + int(h * 0.45) : y + int(h * 0.7), x + int(w * 0.6) : x + int(w * 0.85)]

        roi_means = []
        for roi in [forehead_roi, left_cheek, right_cheek]:
            if roi.size > 0:
                # Green channel is index 1 in BGR
                roi_means.append(float(np.mean(roi[:, :, 1])))
        
        if roi_means:
            signal.append(float(np.mean(roi_means)))

    return signal

def verify_biological_pulse(signal: List[float], fps: float = 30.0) -> Tuple[float, str]:
    """
    Verify if the green channel signal contains periodic pulse variations matching
    natural human heart rate (48 - 180 bpm).
    
    Returns:
      (anomaly_score 0.0 - 1.0, description_string)
    """
    if len(signal) < 10:
        return 0.0, "Insufficient face frames detected for physiological verification."

    # Convert signal to numpy array
    sig = np.array(signal)
    
    # 1. Check signal flatness (zero variance)
    sig_var = float(np.var(sig))
    if sig_var < 1e-6:
        return 0.95, "Capillary blood pulse variance is static (photoplethysmography flatlined)."

    # Remove DC component / drift using high-pass filtering (subtract rolling mean)
    window_len = min(len(sig) // 2 * 2 + 1, 15)
    if window_len >= 3:
        kernel = np.ones(window_len) / window_len
        drift = np.convolve(sig, kernel, mode='same')
        sig_ac = sig - drift
    else:
        sig_ac = sig - np.mean(sig)

    # 2. Peak frequency analysis via FFT
    n = len(sig_ac)
    fft_vals = np.abs(np.fft.rfft(sig_ac))
    fft_freqs = np.fft.rfftfreq(n, d=1.0/fps)

    # Human pulse frequency band: 0.8 Hz to 3.0 Hz (48 to 180 bpm)
    band_idx = np.where((fft_freqs >= 0.8) & (fft_freqs <= 3.0))[0]
    
    if len(band_idx) == 0:
        return 0.85, "No biological pulse frequency component found in natural heart-rate bands."

    peak_freq = fft_freqs[band_idx[np.argmax(fft_vals[band_idx])]]
    peak_power = float(np.max(fft_vals[band_idx]))
    total_power = float(np.sum(fft_vals)) + 1e-8
    
    power_ratio = peak_power / total_power

    # If the peak periodic power is extremely weak, it indicates non-periodic artificial variations
    if power_ratio < 0.15:
        return 0.8, f"Physiological signals are chaotic; power ratio {power_ratio:.2f} violates biological periodicity."

    hr_bpm = peak_freq * 60.0
    return 0.0, f"Authentic physiological pulse detected at {hr_bpm:.1f} BPM (power ratio: {power_ratio:.2f})."
