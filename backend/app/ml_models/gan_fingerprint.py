"""
app/ml_models/gan_fingerprint.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAN Model Fingerprinting via Spectral Analysis

Identifies which specific AI model generated an image by analyzing
DCT/FFT frequency-domain residual patterns unique to different GAN
architectures (StyleGAN, ProGAN, DALL-E, Midjourney, Stable Diffusion).
"""
from __future__ import annotations

import io
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import structlog
from PIL import Image

log = structlog.get_logger(__name__)

# Known GAN spectral signatures (simplified frequency band energy ratios)
GAN_SIGNATURES: Dict[str, Dict[str, Any]] = {
    "StyleGAN2/3": {
        "hf_ratio_range": (0.15, 0.35),
        "radial_symmetry_min": 0.7,
        "dct_peak_bands": [16, 32, 64],
        "description": "NVIDIA StyleGAN architecture with progressive growing",
    },
    "Stable Diffusion": {
        "hf_ratio_range": (0.08, 0.22),
        "radial_symmetry_min": 0.5,
        "dct_peak_bands": [8, 16, 48],
        "description": "Latent diffusion model (Stability AI / open-source)",
    },
    "DALL-E 3": {
        "hf_ratio_range": (0.05, 0.18),
        "radial_symmetry_min": 0.4,
        "dct_peak_bands": [4, 12, 32],
        "description": "OpenAI DALL-E 3 image generation model",
    },
    "Midjourney v5/v6": {
        "hf_ratio_range": (0.10, 0.28),
        "radial_symmetry_min": 0.55,
        "dct_peak_bands": [12, 24, 56],
        "description": "Midjourney proprietary diffusion model",
    },
    "ProGAN": {
        "hf_ratio_range": (0.20, 0.45),
        "radial_symmetry_min": 0.75,
        "dct_peak_bands": [32, 64, 96],
        "description": "Progressive GAN (NVIDIA research)",
    },
    "DeepFaceLab / FaceSwap": {
        "hf_ratio_range": (0.25, 0.50),
        "radial_symmetry_min": 0.3,
        "dct_peak_bands": [48, 64, 80],
        "description": "Face-swap autoencoder models",
    },
}


class GANFingerprinter:
    """
    Identifies the probable GAN architecture behind a synthetic image.
    """

    def analyze(self, image_buffer: bytes) -> Dict[str, Any]:
        """
        Analyze image for GAN model fingerprints.

        Returns:
            Dict with probable_model, confidence, spectral_features,
            all_model_scores, and description.
        """
        try:
            pil_image = Image.open(io.BytesIO(image_buffer)).convert("L")
            img_arr = np.array(pil_image.resize((256, 256)), dtype=np.float32)

            features = self._extract_spectral_features(img_arr)
            scores = self._match_signatures(features)

            # Sort by confidence
            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            top_model, top_score = ranked[0] if ranked else ("Unknown", 0.0)

            is_synthetic = top_score > 30.0

            return {
                "probable_model": top_model if is_synthetic else "Natural / Camera Capture",
                "confidence": round(top_score, 2),
                "is_synthetic": is_synthetic,
                "spectral_features": {
                    "hf_energy_ratio": round(features["hf_ratio"], 4),
                    "radial_symmetry": round(features["radial_symmetry"], 4),
                    "dct_band_energies": [round(e, 4) for e in features["dct_band_energies"][:5]],
                    "grid_artifact_score": round(features["grid_artifact_score"], 4),
                },
                "all_model_scores": {
                    model: round(score, 2) for model, score in ranked
                },
                "description": GAN_SIGNATURES.get(top_model, {}).get(
                    "description", "Could not identify specific generator model."
                ) if is_synthetic else "No strong GAN fingerprint detected. Likely a natural photograph.",
            }

        except Exception as e:
            log.warning("gan_fingerprint.analysis_failed", error=str(e))
            return {
                "probable_model": "Unknown",
                "confidence": 0.0,
                "is_synthetic": False,
                "spectral_features": {},
                "all_model_scores": {},
                "description": f"Analysis failed: {str(e)}",
            }

    def _extract_spectral_features(self, img_arr: np.ndarray) -> Dict[str, Any]:
        """Extract frequency-domain features for GAN fingerprinting."""
        h, w = img_arr.shape

        # 1. FFT Analysis
        fft = np.fft.fft2(img_arr)
        fft_shifted = np.fft.fftshift(fft)
        magnitude = np.abs(fft_shifted) + 1e-8
        log_magnitude = np.log(magnitude)

        cy, cx = h // 2, w // 2

        # High-frequency energy ratio
        radius = min(h, w) // 4
        y_grid, x_grid = np.ogrid[:h, :w]
        dist = np.sqrt((y_grid - cy) ** 2 + (x_grid - cx) ** 2)
        total_energy = magnitude.sum()
        hf_energy = magnitude[dist > radius].sum()
        hf_ratio = float(hf_energy / total_energy)

        # 2. Radial symmetry (GANs produce radially symmetric spectra)
        radial_profile = self._compute_radial_profile(log_magnitude, cy, cx)
        # Symmetry score: compare opposite quadrants
        q1 = log_magnitude[:cy, :cx]
        q3 = log_magnitude[cy:, cx:]
        # Resize to match if needed
        min_h = min(q1.shape[0], q3.shape[0])
        min_w = min(q1.shape[1], q3.shape[1])
        q1_crop = q1[:min_h, :min_w]
        q3_crop = q3[:min_h, :min_w]
        q3_flip = q3_crop[::-1, ::-1]
        corr = np.corrcoef(q1_crop.flatten(), q3_flip.flatten())[0, 1]
        radial_symmetry = float(max(0, corr)) if not np.isnan(corr) else 0.0

        # 3. DCT band energies
        from scipy.fft import dctn
        dct = dctn(img_arr, norm="ortho")
        dct_abs = np.abs(dct)
        band_size = max(h // 8, 1)
        dct_band_energies = []
        for i in range(8):
            start = i * band_size
            end = min((i + 1) * band_size, h)
            band_energy = float(dct_abs[start:end, :].mean())
            dct_band_energies.append(band_energy)

        # 4. Grid artifact detection (some GANs produce periodic artifacts)
        # Check for peaks at regular intervals in FFT
        row_profile = magnitude[cy, :]
        col_profile = magnitude[:, cx]
        # Find peaks
        row_peaks = self._find_periodic_peaks(row_profile)
        col_peaks = self._find_periodic_peaks(col_profile)
        grid_artifact_score = float(len(row_peaks) + len(col_peaks)) / 20.0

        return {
            "hf_ratio": hf_ratio,
            "radial_symmetry": radial_symmetry,
            "dct_band_energies": dct_band_energies,
            "grid_artifact_score": min(grid_artifact_score, 1.0),
            "radial_profile": radial_profile[:10].tolist(),
        }

    def _match_signatures(self, features: Dict[str, Any]) -> Dict[str, float]:
        """Score each known GAN architecture against extracted features."""
        scores = {}

        for model_name, sig in GAN_SIGNATURES.items():
            score = 0.0
            hf_lo, hf_hi = sig["hf_ratio_range"]
            hf_ratio = features["hf_ratio"]

            # HF energy match (40% weight)
            if hf_lo <= hf_ratio <= hf_hi:
                # Perfect match at center of range
                center = (hf_lo + hf_hi) / 2
                spread = (hf_hi - hf_lo) / 2
                proximity = 1.0 - abs(hf_ratio - center) / spread
                score += 40 * proximity
            elif hf_ratio < hf_lo:
                score += max(0, 20 * (1 - (hf_lo - hf_ratio) / 0.2))
            else:
                score += max(0, 20 * (1 - (hf_ratio - hf_hi) / 0.2))

            # Radial symmetry match (30% weight)
            if features["radial_symmetry"] >= sig["radial_symmetry_min"]:
                excess = features["radial_symmetry"] - sig["radial_symmetry_min"]
                score += min(30, 20 + excess * 50)
            else:
                deficit = sig["radial_symmetry_min"] - features["radial_symmetry"]
                score += max(0, 20 * (1 - deficit / 0.3))

            # DCT band correlation (20% weight)
            dct_bands = features["dct_band_energies"]
            peak_bands = sig["dct_peak_bands"]
            band_match = sum(1 for b in peak_bands if b // 32 < len(dct_bands) and dct_bands[b // 32] > np.mean(dct_bands))
            score += 20 * (band_match / max(len(peak_bands), 1))

            # Grid artifact bonus (10% weight)
            score += features["grid_artifact_score"] * 10

            scores[model_name] = float(np.clip(score, 0, 100))

        return scores

    @staticmethod
    def _compute_radial_profile(log_magnitude: np.ndarray, cy: int, cx: int) -> np.ndarray:
        """Compute radial average profile of FFT magnitude."""
        h, w = log_magnitude.shape
        y_grid, x_grid = np.ogrid[:h, :w]
        dist = np.sqrt((y_grid - cy) ** 2 + (x_grid - cx) ** 2).astype(int)
        max_radius = min(cy, cx)
        profile = np.zeros(max_radius)
        count = np.zeros(max_radius)
        for r in range(max_radius):
            mask = dist == r
            if mask.any():
                profile[r] = log_magnitude[mask].mean()
                count[r] = mask.sum()
        return profile

    @staticmethod
    def _find_periodic_peaks(profile: np.ndarray, threshold_factor: float = 2.0) -> List[int]:
        """Find peaks in a 1D profile that exceed threshold_factor * median."""
        median_val = np.median(profile)
        threshold = median_val * threshold_factor
        peaks = []
        for i in range(1, len(profile) - 1):
            if profile[i] > threshold and profile[i] > profile[i-1] and profile[i] > profile[i+1]:
                peaks.append(i)
        return peaks

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_name": "GAN Fingerprinter",
            "model_type": "spectral_gan_classifier",
            "known_architectures": list(GAN_SIGNATURES.keys()),
        }
