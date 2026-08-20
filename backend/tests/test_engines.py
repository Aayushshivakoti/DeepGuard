"""
tests/test_engines.py — Unit Tests for AI Engine Modules
"""
from __future__ import annotations

import io
import pytest
import numpy as np
from PIL import Image


pytestmark = pytest.mark.asyncio


class TestSpatialEngine:
    """Unit tests for spatial_engine.py"""

    async def test_analyze_image_returns_result(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import analyze_image
        result = await analyze_image(sample_jpeg_bytes)
        assert result is not None
        assert 0.0 <= result.confidence <= 100.0
        assert result.verdict in ("AUTHENTIC", "SUSPICIOUS", "DEEPFAKE_DETECTED")

    async def test_analyze_image_png(self, sample_png_bytes: bytes):
        from app.services.spatial_engine import analyze_image
        result = await analyze_image(sample_png_bytes)
        assert result is not None
        assert isinstance(result.flags, list)

    async def test_invalid_buffer_raises(self):
        from app.services.spatial_engine import analyze_image
        with pytest.raises(ValueError):
            await analyze_image(b"not an image")

    def test_fft_anomaly_score_range(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import _fft_anomaly_score
        from PIL import Image
        img = Image.open(io.BytesIO(sample_jpeg_bytes))
        score, _ = _fft_anomaly_score(img)
        assert 0.0 <= score <= 1.0

    def test_detect_faces_no_face(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import _detect_faces
        from PIL import Image
        img = Image.open(io.BytesIO(sample_jpeg_bytes))
        faces, _ = _detect_faces(img)
        assert isinstance(faces, list)

    def test_heuristic_score_range(self):
        from app.services.spatial_engine import _heuristic_score
        for fft in [0.0, 0.3, 0.7, 1.0]:
            for faces in [0, 1, 2]:
                score = _heuristic_score(fft, faces)
                assert 0.0 <= score <= 100.0


class TestAudioEngine:
    """Unit tests for audio_engine.py"""

    async def test_analyze_audio_returns_result(self, sample_wav_bytes: bytes):
        from app.services.audio_engine import analyze_audio
        result = await analyze_audio(sample_wav_bytes, ext="wav")
        assert result is not None
        assert 0.0 <= result.confidence <= 100.0
        assert result.verdict in ("AUTHENTIC", "SUSPICIOUS", "DEEPFAKE_DETECTED")

    async def test_analyze_audio_has_metadata(self, sample_wav_bytes: bytes):
        from app.services.audio_engine import analyze_audio
        result = await analyze_audio(sample_wav_bytes, ext="wav")
        assert isinstance(result.spectrogram_metadata, dict)
        assert isinstance(result.flags, list)

    async def test_invalid_audio_raises(self):
        from app.services.audio_engine import analyze_audio
        with pytest.raises((ValueError, Exception)):
            await analyze_audio(b"not audio data", ext="wav")

    def test_spectral_flatness_range(self, sample_wav_bytes: bytes):
        try:
            import librosa
            import numpy as np
            from app.services.audio_engine import _spectral_flatness_score, _load_audio
            y, sr = _load_audio(sample_wav_bytes, "wav")
            flatness = _spectral_flatness_score(y)
            assert 0.0 <= flatness <= 1.0
        except ImportError:
            pytest.skip("librosa not available")


class TestPhishingEngine:
    """Unit tests for phishing_engine.py"""

    async def test_phishing_url_high_score(self):
        from app.services.phishing_engine import analyze_url
        result = await analyze_url("http://paypa1-secure-login.xyz/account/verify")
        assert result.confidence > 40.0
        assert result.verdict in ("PHISHING_DETECTED", "SUSPICIOUS")

    async def test_clean_url_low_score(self):
        from app.services.phishing_engine import analyze_url
        result = await analyze_url("https://www.google.com/search?q=python")
        assert result.confidence < 60.0

    async def test_ip_url_flagged(self):
        from app.services.phishing_engine import analyze_url, _is_ip_url
        assert _is_ip_url("http://192.168.1.1/login") is True
        assert _is_ip_url("https://www.google.com") is False

    def test_typosquatting_detects_paypal(self):
        from app.services.phishing_engine import _typosquatting_score
        score, brand = _typosquatting_score("paypa1")
        assert score > 0.3
        assert brand == "paypal"

    def test_typosquatting_ignores_exact_match(self):
        from app.services.phishing_engine import _typosquatting_score
        score, brand = _typosquatting_score("paypal")
        assert score == 0.0

    def test_phishing_keywords_found(self):
        from app.services.phishing_engine import _check_phishing_keywords
        found = _check_phishing_keywords("http://evil.com/secure-login/verify-account")
        assert "login" in found or "verify" in found or "secure" in found

    def test_suspicious_tld_detection(self):
        from app.services.phishing_engine import SUSPICIOUS_TLDS
        assert "xyz" in SUSPICIOUS_TLDS
        assert "tk" in SUSPICIOUS_TLDS
        assert "com" not in SUSPICIOUS_TLDS

    def test_exif_analysis_no_exif(self, sample_jpeg_bytes: bytes):
        from app.services.phishing_engine import analyze_file_metadata
        result = analyze_file_metadata(sample_jpeg_bytes, "test.jpg")
        assert result is not None
        assert isinstance(result.flags, list)


class TestOrchestrator:
    """Integration tests for the orchestrator dispatch logic."""

    async def test_dispatch_image(self, sample_jpeg_bytes: bytes):
        from app.services.orchestrator import dispatch_file_scan
        response = await dispatch_file_scan(sample_jpeg_bytes, "test.jpg", "image/jpeg")
        assert response.verdict in ("AUTHENTIC", "SUSPICIOUS", "DEEPFAKE_DETECTED")
        assert response.media_type == "image"

    async def test_dispatch_url(self):
        from app.services.orchestrator import dispatch_url_scan
        response = await dispatch_url_scan("http://test-phishing.xyz/login")
        assert response.verdict in ("PHISHING_DETECTED", "SUSPICIOUS", "AUTHENTIC")
        assert response.media_type == "url"

    async def test_dispatch_audio(self, sample_wav_bytes: bytes):
        from app.services.orchestrator import dispatch_file_scan
        response = await dispatch_file_scan(sample_wav_bytes, "test.wav", "audio/wav", ext="wav")
        assert response.media_type == "audio"

    async def test_response_id_is_uuid(self, sample_jpeg_bytes: bytes):
        from app.services.orchestrator import dispatch_file_scan
        import uuid
        response = await dispatch_file_scan(sample_jpeg_bytes, "test.jpg", "image/jpeg")
        # Should be a valid UUID string
        uuid.UUID(response.id)  # raises if not valid
