"""
app/ml_models/audio_model.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voice-Clone Detection Model

1D CNN classifier trained on ASVspoof-style Mel-spectrogram + MFCC
features for detecting synthetic/cloned speech. Supports:
  - PyTorch weight loading
  - ONNX Runtime acceleration
  - Heuristic ZCR/spectral-flatness fallback when USE_MOCK_MODELS=true
"""
from __future__ import annotations

import io
import os
import tempfile
from typing import Dict, Any, Tuple

import numpy as np
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# Audio feature constants
SAMPLE_RATE = 16000
N_MELS = 128
N_MFCC = 40
HOP_LENGTH = 512
N_FFT = 2048
MAX_DURATION_SEC = 30


class VoiceCloneDetectionCNN:
    """
    Lightweight 1D CNN for voice-clone classification.
    Input: concatenated Mel-spectrogram + MFCC feature vector.
    Output: 2-class logits (authentic, synthetic).
    """

    def __init__(self):
        self.model = None
        self.device = settings.MODEL_DEVICE

    def build(self):
        """Build the PyTorch CNN architecture."""
        import torch
        import torch.nn as nn

        class VoiceCloneCNN(nn.Module):
            def __init__(self):
                super().__init__()
                self.features = nn.Sequential(
                    nn.Conv1d(1, 32, kernel_size=5, padding=2),
                    nn.BatchNorm1d(32),
                    nn.ReLU(),
                    nn.MaxPool1d(2),
                    nn.Conv1d(32, 64, kernel_size=5, padding=2),
                    nn.BatchNorm1d(64),
                    nn.ReLU(),
                    nn.MaxPool1d(2),
                    nn.Conv1d(64, 128, kernel_size=3, padding=1),
                    nn.BatchNorm1d(128),
                    nn.ReLU(),
                    nn.AdaptiveAvgPool1d(1),
                )
                self.classifier = nn.Sequential(
                    nn.Dropout(0.3),
                    nn.Linear(128, 64),
                    nn.ReLU(),
                    nn.Dropout(0.2),
                    nn.Linear(64, 2),
                )

            def forward(self, x):
                x = self.features(x)
                x = x.squeeze(-1)
                return self.classifier(x)

        self.model = VoiceCloneCNN()
        return self.model


class VoiceCloneDetector:
    """
    Production voice-clone detector with feature extraction and inference.
    """

    def __init__(self):
        self.cnn = VoiceCloneDetectionCNN()
        self.onnx_session = None
        self.use_mock = settings.USE_MOCK_MODELS
        self.device = settings.MODEL_DEVICE

        if not self.use_mock:
            self._load_model()

    def _load_model(self):
        """Load trained weights or ONNX session."""
        weight_path = settings.AUDIO_MODEL_PATH
        onnx_path = weight_path.replace(".pt", ".onnx")

        # Try ONNX first
        if os.path.exists(onnx_path):
            try:
                from app.services.onnx_wrapper import ONNXModelWrapper
                self.onnx_session = ONNXModelWrapper(onnx_path)
                log.info("audio_model.onnx_loaded", path=onnx_path)
                return
            except Exception as e:
                log.warning("audio_model.onnx_fallback", error=str(e))

        # PyTorch fallback
        if os.path.exists(weight_path):
            try:
                import torch
                model = self.cnn.build()
                state_dict = torch.load(weight_path, map_location=self.device, weights_only=True)
                model.load_state_dict(state_dict, strict=False)
                model.to(self.device)
                model.eval()
                log.info("audio_model.pytorch_loaded", path=weight_path)
            except Exception as e:
                log.error("audio_model.load_failed", error=str(e))
                self.use_mock = True
        else:
            log.warning("audio_model.weights_not_found", path=weight_path)
            self.use_mock = True

    def extract_features(self, audio_buffer: bytes, ext: str = "wav") -> Dict[str, Any]:
        """
        Extract Mel-spectrogram, MFCC, ZCR, spectral flatness, and phase
        features from raw audio bytes.
        """
        import librosa

        # Write buffer to temp file for librosa
        suffix = f".{ext}" if not ext.startswith(".") else ext
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_buffer)
            tmp_path = tmp.name

        try:
            y, sr = librosa.load(tmp_path, sr=SAMPLE_RATE, mono=True,
                                 duration=MAX_DURATION_SEC)

            # Core features
            mel_spec = librosa.feature.melspectrogram(
                y=y, sr=sr, n_mels=N_MELS, hop_length=HOP_LENGTH, n_fft=N_FFT
            )
            mel_db = librosa.power_to_db(mel_spec, ref=np.max)
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
            mfcc_delta = librosa.feature.delta(mfcc)
            mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

            # Heuristic features
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            spectral_flatness = librosa.feature.spectral_flatness(y=y)[0]
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            rms = librosa.feature.rms(y=y)[0]

            # Phase discontinuity
            stft = librosa.stft(y, n_fft=N_FFT, hop_length=HOP_LENGTH)
            phase = np.angle(stft)
            phase_diff = np.diff(phase, axis=1)
            phase_discontinuity = float(np.std(phase_diff))

            return {
                "mel_spectrogram": mel_db,
                "mfcc": mfcc,
                "mfcc_delta": mfcc_delta,
                "mfcc_delta2": mfcc_delta2,
                "zcr_mean": float(zcr.mean()),
                "zcr_std": float(zcr.std()),
                "spectral_flatness_mean": float(spectral_flatness.mean()),
                "spectral_flatness_std": float(spectral_flatness.std()),
                "spectral_centroid_mean": float(spectral_centroid.mean()),
                "rms_mean": float(rms.mean()),
                "rms_std": float(rms.std()),
                "phase_discontinuity": phase_discontinuity,
                "duration_sec": float(len(y) / sr),
                "sample_rate": sr,
            }
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def predict(self, audio_buffer: bytes, ext: str = "wav") -> Tuple[float, Dict[str, Any]]:
        """
        Run voice-clone detection on raw audio bytes.

        Returns:
            (synthetic_probability 0-100, feature_metadata dict)
        """
        features = self.extract_features(audio_buffer, ext)

        if self.use_mock:
            return self._heuristic_predict(features), features

        # Build feature vector for CNN
        feature_vector = self._build_feature_vector(features)

        # ONNX inference
        if self.onnx_session and self.onnx_session.session:
            logits = self.onnx_session.run_inference(feature_vector)
            prob = self._logits_to_probability(logits)
            return prob, features

        # PyTorch inference
        if self.cnn.model is not None:
            import torch
            with torch.no_grad():
                tensor = torch.from_numpy(feature_vector).to(self.device)
                logits = self.cnn.model(tensor).cpu().numpy()
            prob = self._logits_to_probability(logits)
            return prob, features

        return self._heuristic_predict(features), features

    def _build_feature_vector(self, features: Dict[str, Any]) -> np.ndarray:
        """Flatten extracted features into a 1D input vector for the CNN."""
        # Concatenate mean MFCC + delta + delta2 + scalar features
        mfcc_mean = features["mfcc"].mean(axis=1)       # (40,)
        delta_mean = features["mfcc_delta"].mean(axis=1) # (40,)
        delta2_mean = features["mfcc_delta2"].mean(axis=1) # (40,)

        scalar_features = np.array([
            features["zcr_mean"],
            features["zcr_std"],
            features["spectral_flatness_mean"],
            features["spectral_flatness_std"],
            features["spectral_centroid_mean"],
            features["rms_mean"],
            features["rms_std"],
            features["phase_discontinuity"],
        ], dtype=np.float32)

        combined = np.concatenate([mfcc_mean, delta_mean, delta2_mean, scalar_features])
        # Reshape for CNN: (batch=1, channels=1, features)
        return combined.reshape(1, 1, -1).astype(np.float32)

    def _logits_to_probability(self, logits: np.ndarray) -> float:
        """Convert raw logits to synthetic voice probability (0-100)."""
        from scipy.special import softmax
        probs = softmax(logits[0])
        return float(probs[1]) * 100.0  # Index 1 = synthetic class

    def _heuristic_predict(self, features: Dict[str, Any]) -> float:
        """
        Heuristic voice-clone scoring based on acoustic anomaly indicators.
        """
        score = 0.0
        reasons = []

        # High ZCR variance → natural speech has irregular zero crossings
        zcr_std = features["zcr_std"]
        if zcr_std < 0.02:
            score += 25.0
            reasons.append("unnaturally_consistent_zcr")

        # Very low spectral flatness → synthetic voices often have cleaner spectra
        sf_mean = features["spectral_flatness_mean"]
        if sf_mean < 0.01:
            score += 20.0
            reasons.append("low_spectral_flatness")
        elif sf_mean > 0.3:
            score += 15.0
            reasons.append("high_spectral_flatness")

        # Phase discontinuity — vocoders produce smoother phase
        phase_disc = features["phase_discontinuity"]
        if phase_disc < 0.5:
            score += 20.0
            reasons.append("smooth_phase_vocoder_artifact")

        # Low RMS variance → synthetic speech has uniform energy
        rms_std = features["rms_std"]
        if rms_std < 0.01:
            score += 15.0
            reasons.append("uniform_energy_envelope")

        # Very short duration (< 2s) is suspicious
        if features["duration_sec"] < 2.0:
            score += 5.0

        score = float(np.clip(score, 5, 95))

        log.debug("audio_model.heuristic_score", score=score, reasons=reasons)
        return score

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": "VoiceCloneCNN",
            "model_type": "audio_synthetic_voice_detector",
            "sample_rate": SAMPLE_RATE,
            "max_duration": MAX_DURATION_SEC,
            "num_classes": 2,
            "device": self.device,
            "is_mock": self.use_mock,
        }
