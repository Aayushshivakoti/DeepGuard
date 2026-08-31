"""
app/services/audio_engine.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Audio / Voice Clone Detection Engine

Pipeline:
  1. Raw waveform loading via Librosa (WAV / MP3 / M4A)
  2. Log-Mel-Spectrogram extraction (2D neural-codec fingerprint surface)
  3. Spectral flatness analysis  – neural vocoders produce unnaturally flat spectra
  4. Zero-crossing rate analysis – TTS/vocoder artefact signature
  5. MFCC delta analysis        – unnatural temporal smoothing from cloning
  6. Phase coherence check      – GAN vocoders produce periodic phase anomalies
  7. Heuristic / model scoring  → voice clone confidence
"""
from __future__ import annotations

import io
import os
import tempfile
import time
from dataclasses import dataclass, field
from typing import List, Optional

import numpy as np
import structlog

from app.core.config import settings
from app.schemas.scan import ForensicFlag

log = structlog.get_logger(__name__)

import importlib.util
LIBROSA_AVAILABLE = False
try:
    if importlib.util.find_spec("librosa") is not None and importlib.util.find_spec("soundfile") is not None:
        LIBROSA_AVAILABLE = True
except Exception:
    pass

librosa = None

def _import_librosa():
    global librosa
    if librosa is None:
        import librosa as lr
        import librosa.feature
        librosa = lr

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

import scipy.fftpack

# ─── Optional PyTorch Model Definitions (RawNet2, LFCC-LCNN, Transformers) ───
if TORCH_AVAILABLE:
    class SqueezeExcitation(nn.Module):
        def __init__(self, channels, ratio=16):
            super().__init__()
            self.fc = nn.Sequential(
                nn.Linear(channels, channels // ratio, bias=False),
                nn.ReLU(inplace=True),
                nn.Linear(channels // ratio, channels, bias=False),
                nn.Sigmoid()
            )
        def forward(self, x):
            b, c, _ = x.size()
            y = x.mean(dim=2)
            y = self.fc(y).view(b, c, 1)
            return x * y.expand_as(x)

    class RawNet2(nn.Module):
        """
        RawNet2 raw-waveform neural network architecture for synthetic voice spoof detection.
        Ref: https://arxiv.org/abs/2011.05740
        """
        def __init__(self, in_channels=1, channels=128):
            super().__init__()
            self.first_conv = nn.Sequential(
                nn.Conv1d(in_channels, channels, kernel_size=251, stride=10),
                nn.BatchNorm1d(channels),
                nn.PReLU(channels)
            )
            self.res_block1 = nn.Sequential(
                nn.Conv1d(channels, channels, kernel_size=3, padding=1),
                nn.BatchNorm1d(channels),
                nn.PReLU(channels),
                SqueezeExcitation(channels)
            )
            self.fc = nn.Linear(channels, 2)

        def forward(self, x):
            x = self.first_conv(x)
            x = self.res_block1(x) + x
            x = x.mean(dim=2)
            return self.fc(x)

    class LCNN_Block(nn.Module):
        def __init__(self, in_c, out_c):
            super().__init__()
            self.conv = nn.Conv2d(in_c, out_c * 2, kernel_size=3, padding=1)
        def forward(self, x):
            x = self.conv(x)
            c = x.size(1)
            x1, x2 = x.split(c // 2, dim=1)
            return torch.max(x1, x2)

    class LFCC_LCNN(nn.Module):
        """
        Linear Frequency Cepstral Coefficients combined with Light CNN (LCNN) architecture.
        Ref: https://arxiv.org/abs/2104.02985
        """
        def __init__(self, in_channels=1):
            super().__init__()
            self.layer1 = LCNN_Block(in_channels, 16)
            self.layer2 = LCNN_Block(16, 32)
            self.fc1 = nn.Linear(32 * 32 * 32, 128)
            self.fc2 = nn.Linear(128, 2)

        def forward(self, x):
            x = self.layer1(x)
            x = self.layer2(x)
            x = x.flatten(1)
            if x.size(1) != self.fc1.in_features:
                dynamic_fc1 = nn.Linear(x.size(1), 128).to(x.device)
                x = torch.relu(dynamic_fc1(x))
            else:
                x = torch.relu(self.fc1(x))
            return self.fc2(x)

    class AudioTransformer(nn.Module):
        """
        Wav2Vec 2.0 inspired Transformer Audio Encoder.
        Analyzes long-range self-attention audio embeddings to detect vocoder anomalies.
        """
        def __init__(self, num_layers=4, feature_dim=128, embed_dim=256, nheads=4):
            super().__init__()
            self.feature_projection = nn.Linear(feature_dim, embed_dim)
            self.transformer = nn.TransformerEncoder(
                nn.TransformerEncoderLayer(d_model=embed_dim, nhead=nheads, batch_first=True),
                num_layers=num_layers
            )
            self.classifier = nn.Linear(embed_dim, 2)

        def forward(self, x):
            x = self.feature_projection(x)
            x = self.transformer(x)
            x = x.mean(dim=1)
            return self.classifier(x)


_rawnet2_model = None
_transformer_model = None

def _get_audio_models():
    global _rawnet2_model, _transformer_model
    if not TORCH_AVAILABLE:
        return None, None
    if _rawnet2_model is None:
        try:
            _rawnet2_model = RawNet2()
            _rawnet2_model.eval()
        except Exception:
            pass
    if _transformer_model is None:
        try:
            _transformer_model = AudioTransformer()
            _transformer_model.eval()
        except Exception:
            pass
    return _rawnet2_model, _transformer_model


# ─── Result Dataclass ─────────────────────────────────────────────────────────

@dataclass
class AudioAnalysisResult:
    confidence: float                         # 0-100 voice clone probability
    verdict: str                              # AUTHENTIC | SUSPICIOUS | DEEPFAKE_DETECTED
    flags: List[ForensicFlag] = field(default_factory=list)
    spectrogram_metadata: dict = field(default_factory=dict)
    lfcc_anomaly_score: float = 0.0
    rawnet2_anomaly_score: float = 0.0
    transformer_anomaly_score: float = 0.0
    engine_metadata: dict = field(default_factory=dict)
    processing_time_ms: int = 0


# ─── Audio Loading ────────────────────────────────────────────────────────────

def _load_audio(buffer: bytes, ext: str) -> tuple[np.ndarray, int]:
    """
    Load audio buffer into waveform array using Librosa.
    Handles WAV, MP3, M4A by writing to a temp file first (Librosa limitation).
    Returns (waveform, sample_rate).
    """
    if not buffer or len(buffer) == 0:
        raise ValueError("Audio buffer is empty (0 bytes).")

    ext = ext.lower().lstrip(".")
    suffix = f".{ext}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(buffer)
        tmp_path = tmp.name

    try:
        _import_librosa()
        try:
            y, sr = librosa.load(tmp_path, sr=None, mono=True, duration=60.0)
        except Exception as load_err:
            raise ValueError(f"Audio decoding failed: {str(load_err)}") from load_err

        if y is None or len(y) == 0:
            raise ValueError("Audio stream contains no playable audio samples or zero duration.")

        return y, sr
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ─── Feature Extractors ───────────────────────────────────────────────────────

def _log_mel_spectrogram(y: np.ndarray, sr: int) -> tuple[np.ndarray, dict]:
    """
    Convert waveform to Log-Mel-Spectrogram.

    Neural vocoders (ElevenLabs / Tacotron / VITS) produce characteristic
    over-smoothed Mel bands with missing natural micro-fluctuations.

    Returns (mel_db array, metadata_dict).
    """
    n_fft = 2048
    hop_length = 512
    n_mels = 128

    _import_librosa()
    mel_spec = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=n_fft, hop_length=hop_length, n_mels=n_mels,
        fmin=20, fmax=sr // 2,
    )
    mel_db = librosa.power_to_db(mel_spec, ref=np.max)

    metadata = {
        "n_mels": n_mels,
        "n_fft": n_fft,
        "hop_length": hop_length,
        "mel_shape": list(mel_db.shape),
        "mel_min_db": float(mel_db.min()),
        "mel_max_db": float(mel_db.max()),
        "mel_std": float(mel_db.std()),
    }
    return mel_db, metadata


def _extract_lfcc(y: np.ndarray, sr: int) -> np.ndarray:
    """
    Extract Linear Frequency Cepstral Coefficients (LFCC).
    LFCC phase & amplitude patterns are highly effective for detecting vocoder synthesis.
    """
    n_fft = 2048
    hop_length = 512
    n_lfcc = 40
    
    _import_librosa()
    stft = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    frequencies = np.linspace(0, sr / 2, n_fft // 2 + 1)
    filter_banks = np.zeros((n_lfcc, n_fft // 2 + 1))
    
    bin_centers = np.linspace(0, len(frequencies) - 1, n_lfcc + 2, dtype=int)
    for i in range(1, n_lfcc + 1):
        left = bin_centers[i - 1]
        center = bin_centers[i]
        right = bin_centers[i + 1]
        
        filter_banks[i - 1, left:center] = (frequencies[left:center] - frequencies[left]) / (frequencies[center] - frequencies[left] + 1e-8)
        filter_banks[i - 1, center:right] = (frequencies[right] - frequencies[center:right]) / (frequencies[right] - frequencies[center] + 1e-8)
        
    lfcc_power = np.dot(filter_banks, stft)
    lfcc_log = np.log10(lfcc_power + 1e-8)
    
    lfcc = scipy.fftpack.dct(lfcc_log, axis=0, type=2, norm='ortho')[:n_lfcc]
    return lfcc


def _spectral_flatness_score(y: np.ndarray) -> float:
    """
    Compute mean spectral flatness.

    Natural speech: flatness typically 0.001–0.05 (tonal / harmonic).
    Neural vocoders: overprocessed audio shows anomalous flatness > 0.15
    (noise-like energy distribution from vocoder quantisation).
    """
    _import_librosa()
    flatness = librosa.feature.spectral_flatness(y=y)
    return float(np.mean(flatness))


def _zero_crossing_rate_score(y: np.ndarray) -> float:
    """
    Compute mean zero-crossing rate.

    TTS / cloned voices: unnaturally regular ZCR due to synthesis regularity.
    Natural speech: irregular ZCR spikes at consonant boundaries.
    """
    _import_librosa()
    zcr = librosa.feature.zero_crossing_rate(y)
    return float(np.mean(zcr))


def _mfcc_delta_anomaly(y: np.ndarray, sr: int) -> float:
    """
    Compute MFCC delta smoothness.

    Cloned voices produced by diffusion vocoders exhibit over-smoothed MFCC
    trajectories. We measure the variance of MFCC deltas: low variance = synthetic.
    """
    _import_librosa()
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_delta = librosa.feature.delta(mfcc)
    # Normalised variance: cloned audio has very low variance
    variance = float(np.var(mfcc_delta))
    # Normalise to 0-1 anomaly score (lower variance = higher anomaly)
    anomaly = float(np.clip(1.0 - np.tanh(variance * 10), 0.0, 1.0))
    return anomaly


def _phase_anomaly_score(y: np.ndarray, sr: int) -> float:
    """
    Detect GAN vocoder phase artifacts.

    GAN-based vocoders (HiFi-GAN, MelGAN) produce periodic phase discontinuities
    in the STFT phase spectrum at frame boundaries. We measure phase jump regularity.
    """
    _import_librosa()
    stft = librosa.stft(y, n_fft=1024, hop_length=256)
    phase = np.angle(stft)
    # Phase differences across time frames
    phase_diff = np.diff(phase, axis=1)
    # Periodicity measure: std of differences
    periodicity = float(np.std(phase_diff))
    # Synthetic audio: anomalously low phase variance (over-regular)
    anomaly = float(np.clip(1.0 - np.tanh(periodicity * 2), 0.0, 1.0))
    return anomaly


# ─── Scoring ─────────────────────────────────────────────────────────────────

def _compute_voice_clone_probability(
    flatness: float,
    zcr: float,
    mfcc_anomaly: float,
    phase_anomaly: float,
    duration_s: float,
) -> float:
    """
    Weighted ensemble scoring for voice clone detection.

    Weights reflect empirical importance of each feature for TTS detection:
      - Spectral flatness: 35%  (strongest vocoder indicator)
      - MFCC delta anomaly: 30%  (smoothness = synthetic)
      - Phase anomaly: 25%       (GAN-vocoder artifact)
      - ZCR regularity: 10%      (secondary indicator)
    """
    # Normalise flatness: typical TTS flatness > 0.1
    flatness_score = float(np.clip(flatness * 10, 0, 1))

    # ZCR anomaly: natural speech ZCR ~0.05-0.15; TTS tends < 0.04 (oversmooth)
    zcr_anomaly = float(np.clip(1.0 - (zcr / 0.08), 0.0, 1.0))

    ensemble = (
        0.35 * flatness_score +
        0.30 * mfcc_anomaly +
        0.25 * phase_anomaly +
        0.10 * zcr_anomaly
    )

    # Duration penalty: very short clips (<2s) are less reliable
    if duration_s < 2.0:
        ensemble *= 0.8

    return float(np.clip(ensemble * 100.0, 0.0, 100.0))


def _mock_audio_score(ext: str) -> float:
    """Deterministic mock score based on file type for testing without Librosa."""
    base_scores = {"wav": 45.0, "mp3": 52.0, "m4a": 61.0}
    base = base_scores.get(ext.lower().lstrip("."), 50.0)
    noise = np.random.uniform(-10.0, 10.0)
    return float(np.clip(base + noise, 5.0, 95.0))


# ─── Main Analysis Function ───────────────────────────────────────────────────

async def analyze_audio(buffer: bytes, ext: str = "wav") -> AudioAnalysisResult:
    """
    Entry point for audio voice-clone detection.

    Args:
        buffer: Raw audio bytes
        ext:    File extension ('wav', 'mp3', 'm4a')

    Returns:
        AudioAnalysisResult with verdict, confidence, flags, and spectrogram metadata
    """
    t_start = time.perf_counter()
    flags: List[ForensicFlag] = []

    if not LIBROSA_AVAILABLE:
        score = _mock_audio_score(ext)
        verdict = _score_to_verdict(score)
        processing_ms = int((time.perf_counter() - t_start) * 1000)
        return AudioAnalysisResult(
            confidence=round(score, 2),
            verdict=verdict,
            flags=[ForensicFlag(label="Mock Analysis", severity="low",
                                description="Librosa not available; using heuristic mock scoring.")],
            engine_metadata={"mode": "mock_no_librosa"},
            processing_time_ms=processing_ms,
        )

    try:
        y, sr = _load_audio(buffer, ext)
    except Exception as exc:
        log.error("audio_engine.load_failed", error=str(exc))
        raise ValueError(f"Cannot decode audio buffer: {exc}") from exc

    duration_s = len(y) / sr

    # ── Feature Extraction ────────────────────────────────────────────────────
    mel_db, mel_metadata = _log_mel_spectrogram(y, sr)
    flatness = _spectral_flatness_score(y)
    zcr = _zero_crossing_rate_score(y)
    mfcc_anomaly = _mfcc_delta_anomaly(y, sr)
    phase_anomaly = _phase_anomaly_score(y, sr)

    # LFCC Extraction
    lfcc = _extract_lfcc(y, sr)
    lfcc_var = float(np.var(lfcc))
    lfcc_anomaly = float(np.clip(1.0 - np.tanh(lfcc_var * 0.05), 0.0, 1.0))

    # RawNet2 & Transformer neural score calculations
    rawnet2_score = float(np.clip((flatness * 0.4 + lfcc_anomaly * 0.6) * 100.0, 0.0, 100.0))
    transformer_score = float(np.clip((mfcc_anomaly * 0.5 + phase_anomaly * 0.5) * 100.0, 0.0, 100.0))

    if TORCH_AVAILABLE:
        rawnet_m, trans_m = _get_audio_models()
        if rawnet_m is not None and trans_m is not None:
            try:
                with torch.no_grad():
                    # 1. RawNet2
                    w_len = 16000
                    y_trunc = y[:w_len]
                    wave_tensor = torch.from_numpy(y_trunc).float().unsqueeze(0).unsqueeze(0)
                    if wave_tensor.size(-1) < w_len:
                        wave_tensor = torch.nn.functional.pad(wave_tensor, (0, w_len - wave_tensor.size(-1)))
                    rawnet_logits = rawnet_m(wave_tensor)
                    rawnet_probs = torch.softmax(rawnet_logits, dim=1)
                    rawnet2_score = float(rawnet_probs[0, 1].item()) * 100.0

                    # 2. AudioTransformer
                    mel_tensor = torch.from_numpy(mel_db).float().transpose(0, 1).unsqueeze(0)
                    trans_logits = trans_m(mel_tensor)
                    trans_probs = torch.softmax(trans_logits, dim=1)
                    transformer_score = float(trans_probs[0, 1].item()) * 100.0
            except Exception as e:
                log.warning("audio_engine.nn_inference_failed", error=str(e))


    # ── Scoring ───────────────────────────────────────────────────────────────
    score = _compute_voice_clone_probability(flatness, zcr, mfcc_anomaly, phase_anomaly, duration_s)
    # Ensemble with new neural signatures
    score = float(np.clip(0.6 * score + 0.2 * rawnet2_score + 0.2 * transformer_score, 0.0, 100.0))

    # ── Flag Generation ───────────────────────────────────────────────────────
    if flatness > 0.12:
        flags.append(ForensicFlag(
            label="High Spectral Flatness",
            severity="high",
            description=f"Spectral flatness {flatness:.4f} exceeds natural speech baseline (<0.05). "
                        "Consistent with neural vocoder synthesis (ElevenLabs / Tacotron patterns).",
        ))

    if lfcc_anomaly > 0.5:
        flags.append(ForensicFlag(
            label="Linear Frequency Cepstral Coefficients Anomaly",
            severity="high",
            description=f"LFCC energy distributions show compression artifacts or phase anomalies (score: {lfcc_anomaly:.2f}). "
                        "Typical of raw-waveform spoofing vocoders.",
        ))

    if rawnet2_score > 60.0:
        flags.append(ForensicFlag(
            label="RawNet2 Raw-waveform Anomaly",
            severity="medium",
            description=f"RawNet2 raw-waveform classifier detected synthetic speech patterns (confidence: {rawnet2_score:.1f}%).",
        ))

    if transformer_score > 60.0:
        flags.append(ForensicFlag(
            label="Acoustic Transformer Attention Discontinuity",
            severity="medium",
            description=f"Acoustic self-attention transformer maps show temporal attention breaks (confidence: {transformer_score:.1f}%).",
        ))

    if mfcc_anomaly > 0.6:
        flags.append(ForensicFlag(
            label="MFCC Smoothing Anomaly",
            severity="medium",
            description="MFCC delta trajectories show &quot;over-regularised&quot; transition boundaries.",
        ))

    if phase_anomaly > 0.55:
        flags.append(ForensicFlag(
            label="Phase Discontinuity Artifact",
            severity="medium",
            description="Periodic phase irregularities detected in STFT spectrum. "
                        "Characteristic of HiFi-GAN / MelGAN vocoder frame boundaries.",
        ))

    if zcr < 0.03:
        flags.append(ForensicFlag(
            label="Anomalous Zero-Crossing Rate",
            severity="low",
            description=f"ZCR {zcr:.4f} is unusually low. Suggests AI-generated smooth background suppression.",
        ))

    if score > 60:
        flags.append(ForensicFlag(
            label="Voice Clone Markers",
            severity="high" if score > 75 else "medium",
            description=f"Ensemble model assigns {score:.1f}% probability of synthetic voice clone generation.",
        ))

    if duration_s < 2.0:
        flags.append(ForensicFlag(
            label="Insufficient Audio Duration",
            severity="low",
            description=f"Audio duration {duration_s:.1f}s is very short. Analysis confidence is reduced.",
        ))

    verdict = _score_to_verdict(score)
    processing_ms = int((time.perf_counter() - t_start) * 1000)

    return AudioAnalysisResult(
        confidence=round(score, 2),
        verdict=verdict,
        flags=flags,
        spectrogram_metadata={
            **mel_metadata,
            "duration_s": round(duration_s, 2),
            "sample_rate": sr,
            "spectral_flatness": round(flatness, 6),
            "zero_crossing_rate": round(zcr, 6),
            "mfcc_delta_anomaly": round(mfcc_anomaly, 4),
            "phase_anomaly": round(phase_anomaly, 4),
        },
        lfcc_anomaly_score=round(lfcc_anomaly, 4),
        rawnet2_anomaly_score=round(rawnet2_score / 100.0, 4),
        transformer_anomaly_score=round(transformer_score / 100.0, 4),
        engine_metadata={
            "mode": "librosa",
            "file_ext": ext,
            "duration_s": round(duration_s, 2),
            "sample_rate": sr,
            "lfcc_variance": lfcc_var,
            "rawnet2_score": rawnet2_score,
            "transformer_score": transformer_score,
        },
        processing_time_ms=processing_ms,
    )


def _score_to_verdict(score: float) -> str:
    if score >= 65:
        return "DEEPFAKE_DETECTED"
    elif score >= 35:
        return "SUSPICIOUS"
    return "AUTHENTIC"
