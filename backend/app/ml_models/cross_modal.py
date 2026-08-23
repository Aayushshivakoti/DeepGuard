"""
app/ml_models/cross_modal.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cross-Modal Audio-Visual Consistency Checker

Detects deepfakes by checking whether facial expressions (visual
sentiment) correlate with voice emotion (audio sentiment). Low
cross-modal correlation indicates likely synthetic content where
audio and video were independently generated or spliced.
"""
from __future__ import annotations

import io
import tempfile
import os
from typing import Dict, Any, List, Tuple

import numpy as np
import structlog

log = structlog.get_logger(__name__)


class CrossModalConsistencyChecker:
    """
    Check audio-visual emotional consistency in video content.
    """

    def analyze(
        self,
        video_frames: List[np.ndarray],
        audio_buffer: bytes,
        audio_ext: str = "wav",
    ) -> Dict[str, Any]:
        """
        Analyze cross-modal consistency between video frames and audio.

        Args:
            video_frames: List of BGR frame arrays from video
            audio_buffer: Raw audio bytes extracted from video
            audio_ext: Audio format extension

        Returns:
            Dict with consistency_score, visual_sentiment, audio_sentiment,
            correlation, and explanation.
        """
        try:
            visual_features = self._extract_visual_features(video_frames)
            audio_features = self._extract_audio_features(audio_buffer, audio_ext)

            correlation = self._compute_correlation(visual_features, audio_features)

            # Map correlation to consistency score (0 = inconsistent, 100 = consistent)
            consistency_score = float(np.clip(correlation * 100, 0, 100))

            # Determine if the mismatch is suspicious
            is_suspicious = consistency_score < 40.0

            return {
                "consistency_score": round(consistency_score, 2),
                "is_suspicious": is_suspicious,
                "visual_features": {
                    "motion_energy": round(visual_features.get("motion_energy", 0), 4),
                    "facial_activity": round(visual_features.get("facial_activity", 0), 4),
                    "expression_variance": round(visual_features.get("expression_variance", 0), 4),
                },
                "audio_features": {
                    "speech_rate": round(audio_features.get("speech_rate", 0), 4),
                    "pitch_variance": round(audio_features.get("pitch_variance", 0), 4),
                    "energy_variance": round(audio_features.get("energy_variance", 0), 4),
                },
                "correlation": round(correlation, 4),
                "explanation": self._generate_explanation(consistency_score, visual_features, audio_features),
            }
        except Exception as e:
            log.warning("cross_modal.analysis_failed", error=str(e))
            return {
                "consistency_score": 50.0,
                "is_suspicious": False,
                "visual_features": {},
                "audio_features": {},
                "correlation": 0.5,
                "explanation": f"Cross-modal analysis incomplete: {str(e)}",
            }

    def _extract_visual_features(self, frames: List[np.ndarray]) -> Dict[str, float]:
        """Extract visual emotion/activity features from video frames."""
        if not frames or len(frames) < 2:
            return {"motion_energy": 0.0, "facial_activity": 0.0, "expression_variance": 0.0}

        import cv2

        motion_energies = []
        brightness_values = []
        edge_densities = []

        prev_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY) if len(frames[0].shape) == 3 else frames[0]

        for frame in frames[1:]:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame

            # Optical flow magnitude as motion energy
            flow_diff = cv2.absdiff(prev_gray, gray)
            motion_energies.append(float(flow_diff.mean()) / 255.0)

            # Brightness (proxy for expression intensity)
            brightness_values.append(float(gray.mean()) / 255.0)

            # Edge density (proxy for facial feature activity)
            edges = cv2.Canny(gray, 50, 150)
            edge_densities.append(float(edges.mean()) / 255.0)

            prev_gray = gray

        return {
            "motion_energy": float(np.mean(motion_energies)),
            "facial_activity": float(np.mean(edge_densities)),
            "expression_variance": float(np.std(brightness_values)),
            # Time-series for correlation
            "_motion_series": motion_energies,
            "_edge_series": edge_densities,
        }

    def _extract_audio_features(self, audio_buffer: bytes, ext: str = "wav") -> Dict[str, float]:
        """Extract audio emotion/activity features."""
        if not audio_buffer or len(audio_buffer) < 100:
            return {"speech_rate": 0.0, "pitch_variance": 0.0, "energy_variance": 0.0}

        try:
            import librosa

            suffix = f".{ext}" if not ext.startswith(".") else ext
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_buffer)
                tmp_path = tmp.name

            try:
                y, sr = librosa.load(tmp_path, sr=16000, mono=True, duration=30)

                # RMS energy over time
                rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]

                # Pitch (F0) estimation
                pitches, magnitudes = librosa.piptrack(y=y, sr=sr, hop_length=512)
                pitch_values = []
                for t in range(pitches.shape[1]):
                    idx = magnitudes[:, t].argmax()
                    pitch = pitches[idx, t]
                    if pitch > 0:
                        pitch_values.append(pitch)

                pitch_variance = float(np.std(pitch_values)) if pitch_values else 0.0

                # Zero-crossing rate as proxy for speech rate
                zcr = librosa.feature.zero_crossing_rate(y)[0]

                return {
                    "speech_rate": float(np.mean(zcr)),
                    "pitch_variance": pitch_variance,
                    "energy_variance": float(np.std(rms)),
                    # Time-series for correlation
                    "_energy_series": rms.tolist(),
                    "_zcr_series": zcr.tolist(),
                }
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        except Exception as e:
            log.warning("cross_modal.audio_extraction_failed", error=str(e))
            return {"speech_rate": 0.0, "pitch_variance": 0.0, "energy_variance": 0.0}

    def _compute_correlation(
        self,
        visual_features: Dict[str, Any],
        audio_features: Dict[str, Any],
    ) -> float:
        """
        Compute cross-modal correlation between visual and audio time series.
        """
        motion_series = visual_features.get("_motion_series", [])
        energy_series = audio_features.get("_energy_series", [])

        if len(motion_series) < 5 or len(energy_series) < 5:
            # Fallback: use scalar feature correlation
            visual_vec = np.array([
                visual_features.get("motion_energy", 0),
                visual_features.get("facial_activity", 0),
                visual_features.get("expression_variance", 0),
            ])
            audio_vec = np.array([
                audio_features.get("speech_rate", 0),
                audio_features.get("pitch_variance", 0) / 500.0,  # Normalize
                audio_features.get("energy_variance", 0),
            ])
            # Cosine similarity
            dot = np.dot(visual_vec, audio_vec)
            norms = np.linalg.norm(visual_vec) * np.linalg.norm(audio_vec)
            return float(dot / (norms + 1e-8))

        # Resample both to same length
        target_len = min(len(motion_series), len(energy_series), 100)
        motion_resampled = np.interp(
            np.linspace(0, 1, target_len),
            np.linspace(0, 1, len(motion_series)),
            motion_series,
        )
        energy_resampled = np.interp(
            np.linspace(0, 1, target_len),
            np.linspace(0, 1, len(energy_series)),
            energy_series,
        )

        # Pearson correlation
        corr = np.corrcoef(motion_resampled, energy_resampled)[0, 1]
        return float(corr) if not np.isnan(corr) else 0.5

    @staticmethod
    def _generate_explanation(
        score: float,
        visual: Dict[str, Any],
        audio: Dict[str, Any],
    ) -> str:
        """Generate human-readable explanation of cross-modal results."""
        if score >= 70:
            return (
                "The visual expressions and audio speech patterns show strong consistency. "
                "Facial motion correlates naturally with voice energy and pitch changes."
            )
        elif score >= 40:
            return (
                "Moderate consistency detected between visual and audio channels. "
                "Some segments show temporal misalignment which could indicate editing or compression artifacts."
            )
        else:
            return (
                "Low cross-modal consistency detected: facial expressions do not correlate "
                "with the audio speech patterns. This is a strong indicator that the video "
                "and audio tracks were generated or manipulated independently."
            )

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_name": "Cross-Modal Consistency Checker",
            "model_type": "audio_visual_correlation",
        }
