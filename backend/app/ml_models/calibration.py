"""
app/ml_models/calibration.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model Confidence Calibration & Adaptive Threshold Learning

Provides:
  1. Platt Scaling — logistic regression calibration of model logits
  2. Temperature Scaling — softmax temperature tuning
  3. Adaptive Threshold Learning — adjusts decision thresholds
     from HITL (Human-in-the-Loop) review feedback
"""
from __future__ import annotations

import json
import os
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import structlog

log = structlog.get_logger(__name__)

# Default thresholds (can be overridden by adaptive learning)
DEFAULT_THRESHOLDS = {
    "image": {"deepfake_threshold": 70.0, "suspicious_threshold": 40.0},
    "audio": {"deepfake_threshold": 65.0, "suspicious_threshold": 35.0},
    "video": {"deepfake_threshold": 65.0, "suspicious_threshold": 35.0},
    "url":   {"deepfake_threshold": 65.0, "suspicious_threshold": 35.0},
    "pdf":   {"deepfake_threshold": 65.0, "suspicious_threshold": 35.0},
}

THRESHOLD_CACHE_PATH = "weights/adaptive_thresholds.json"


class PlattScaler:
    """
    Platt scaling: fit a logistic regression to convert raw model scores
    into calibrated probabilities.

    P(y=1 | score) = 1 / (1 + exp(A*score + B))
    """

    def __init__(self, a: float = -1.0, b: float = 0.0):
        self.a = a
        self.b = b
        self._is_fitted = False

    def fit(self, scores: np.ndarray, labels: np.ndarray, max_iter: int = 100):
        """
        Fit Platt scaling parameters A, B using Newton's method.

        Args:
            scores: Raw model output scores (N,)
            labels: Ground truth binary labels (N,) — 0=authentic, 1=deepfake
        """
        n = len(scores)
        if n < 10:
            log.warning("platt.insufficient_data", n=n)
            return

        # Target probabilities (Bayesian correction)
        n_pos = np.sum(labels == 1)
        n_neg = n - n_pos
        t_pos = (n_pos + 1) / (n_pos + 2)
        t_neg = 1.0 / (n_neg + 2)
        targets = np.where(labels == 1, t_pos, t_neg)

        a, b = 0.0, np.log((n_neg + 1) / (n_pos + 1))
        lr = 1e-3

        for iteration in range(max_iter):
            p = 1.0 / (1.0 + np.exp(a * scores + b))
            p = np.clip(p, 1e-8, 1 - 1e-8)

            # Gradient
            diff = p - targets
            grad_a = np.dot(diff, scores)
            grad_b = np.sum(diff)

            a -= lr * grad_a
            b -= lr * grad_b

        self.a = float(a)
        self.b = float(b)
        self._is_fitted = True
        log.info("platt.fitted", a=self.a, b=self.b, n_samples=n)

    def calibrate(self, score: float) -> float:
        """Apply Platt scaling to a raw score. Returns calibrated probability 0-100."""
        if not self._is_fitted:
            return score  # Pass through if not fitted

        p = 1.0 / (1.0 + np.exp(self.a * score + self.b))
        return float(np.clip(p * 100.0, 0, 100))

    def to_dict(self) -> Dict[str, Any]:
        return {"a": self.a, "b": self.b, "is_fitted": self._is_fitted}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "PlattScaler":
        scaler = cls(a=d.get("a", -1.0), b=d.get("b", 0.0))
        scaler._is_fitted = d.get("is_fitted", False)
        return scaler


class TemperatureScaler:
    """
    Temperature scaling for softmax calibration.
    Divides logits by a learned temperature T before softmax.
    """

    def __init__(self, temperature: float = 1.0):
        self.temperature = temperature

    def calibrate_logits(self, logits: np.ndarray) -> np.ndarray:
        """Apply temperature scaling to logits before softmax."""
        scaled = logits / max(self.temperature, 0.01)
        # Stable softmax
        exp_scaled = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
        return exp_scaled / exp_scaled.sum(axis=-1, keepdims=True)

    def fit(self, logits_list: List[np.ndarray], labels: np.ndarray, lr: float = 0.01, max_iter: int = 100):
        """
        Optimize temperature on a validation set using NLL loss.
        """
        all_logits = np.vstack(logits_list)

        best_t = 1.0
        best_nll = float("inf")

        for t_candidate in np.linspace(0.1, 5.0, 50):
            scaled = all_logits / t_candidate
            exp_s = np.exp(scaled - np.max(scaled, axis=-1, keepdims=True))
            probs = exp_s / exp_s.sum(axis=-1, keepdims=True)
            probs = np.clip(probs, 1e-8, 1.0)

            nll = 0.0
            for i, label in enumerate(labels):
                nll -= np.log(probs[i, int(label)])

            if nll < best_nll:
                best_nll = nll
                best_t = t_candidate

        self.temperature = float(best_t)
        log.info("temperature_scaler.fitted", temperature=self.temperature, nll=best_nll)


class AdaptiveThresholdLearner:
    """
    Adjusts verdict thresholds based on HITL review feedback.
    Tracks false-positive and false-negative rates and adjusts
    thresholds to minimize overall error.
    """

    def __init__(self):
        self.thresholds = self._load_thresholds()
        self.feedback_buffer: List[Dict[str, Any]] = []

    def _load_thresholds(self) -> Dict[str, Dict[str, float]]:
        """Load cached thresholds or use defaults."""
        if os.path.exists(THRESHOLD_CACHE_PATH):
            try:
                with open(THRESHOLD_CACHE_PATH, "r") as f:
                    cached = json.load(f)
                log.info("adaptive_threshold.loaded_cache", path=THRESHOLD_CACHE_PATH)
                return cached
            except Exception as e:
                log.warning("adaptive_threshold.cache_load_failed", error=str(e))

        return {k: v.copy() for k, v in DEFAULT_THRESHOLDS.items()}

    def _save_thresholds(self):
        """Persist current thresholds to disk."""
        try:
            os.makedirs(os.path.dirname(THRESHOLD_CACHE_PATH), exist_ok=True)
            with open(THRESHOLD_CACHE_PATH, "w") as f:
                json.dump(self.thresholds, f, indent=2)
            log.info("adaptive_threshold.saved", path=THRESHOLD_CACHE_PATH)
        except Exception as e:
            log.warning("adaptive_threshold.save_failed", error=str(e))

    def get_thresholds(self, media_type: str) -> Tuple[float, float]:
        """
        Get current (deepfake_threshold, suspicious_threshold) for a media type.
        """
        mt = self.thresholds.get(media_type, DEFAULT_THRESHOLDS.get(media_type, DEFAULT_THRESHOLDS["image"]))
        return mt["deepfake_threshold"], mt["suspicious_threshold"]

    def record_feedback(
        self,
        media_type: str,
        model_confidence: float,
        model_verdict: str,
        human_verdict: str,  # "AUTHENTIC", "DEEPFAKE_DETECTED", "SUSPICIOUS"
    ):
        """
        Record a HITL review feedback sample for threshold adaptation.
        """
        self.feedback_buffer.append({
            "media_type": media_type,
            "confidence": model_confidence,
            "model_verdict": model_verdict,
            "human_verdict": human_verdict,
        })

        log.info(
            "adaptive_threshold.feedback_recorded",
            media_type=media_type,
            model_verdict=model_verdict,
            human_verdict=human_verdict,
            buffer_size=len(self.feedback_buffer),
        )

        # Auto-adapt when we have enough samples
        if len(self.feedback_buffer) >= 20:
            self.adapt()

    def adapt(self):
        """
        Recompute thresholds from accumulated feedback.
        Uses simple error-minimizing grid search.
        """
        if len(self.feedback_buffer) < 10:
            log.info("adaptive_threshold.insufficient_feedback", count=len(self.feedback_buffer))
            return

        # Group by media type
        by_type: Dict[str, List[Dict]] = {}
        for fb in self.feedback_buffer:
            mt = fb["media_type"]
            by_type.setdefault(mt, []).append(fb)

        for media_type, samples in by_type.items():
            if len(samples) < 5:
                continue

            confidences = np.array([s["confidence"] for s in samples])
            is_actually_fake = np.array([
                1 if s["human_verdict"] in ("DEEPFAKE_DETECTED", "PHISHING_DETECTED") else 0
                for s in samples
            ])

            # Grid search for optimal deepfake threshold
            best_threshold = 70.0
            best_error = float("inf")

            for thresh in np.arange(30, 90, 2.0):
                predictions = (confidences >= thresh).astype(int)
                error = np.sum(predictions != is_actually_fake)
                if error < best_error:
                    best_error = error
                    best_threshold = float(thresh)

            # Suspicious threshold is typically 60% of deepfake threshold
            suspicious_threshold = best_threshold * 0.6

            self.thresholds[media_type] = {
                "deepfake_threshold": round(best_threshold, 1),
                "suspicious_threshold": round(suspicious_threshold, 1),
            }

            log.info(
                "adaptive_threshold.updated",
                media_type=media_type,
                deepfake_threshold=best_threshold,
                suspicious_threshold=suspicious_threshold,
                n_samples=len(samples),
                error_rate=best_error / len(samples),
            )

        self._save_thresholds()
        self.feedback_buffer.clear()

    def get_info(self) -> Dict[str, Any]:
        return {
            "current_thresholds": self.thresholds,
            "pending_feedback": len(self.feedback_buffer),
            "cache_path": THRESHOLD_CACHE_PATH,
        }


# Module-level singletons
_platt_scaler = PlattScaler()
_temperature_scaler = TemperatureScaler()
_threshold_learner = AdaptiveThresholdLearner()


def get_platt_scaler() -> PlattScaler:
    return _platt_scaler


def get_temperature_scaler() -> TemperatureScaler:
    return _temperature_scaler


def get_threshold_learner() -> AdaptiveThresholdLearner:
    return _threshold_learner
