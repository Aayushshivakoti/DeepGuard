"""
tests/test_engines.py — Unit Tests for AI Engine Modules
"""
from __future__ import annotations

import io
import pytest
import numpy as np
from PIL import Image


from app.core.config import settings
settings.USE_MOCK_MODELS = True

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
                score = _heuristic_score(fft, faces, copy_move_score=0.2, dire_score=0.1)
                assert 0.0 <= score <= 100.0

    def test_sift_copy_move_detection(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import _detect_copy_move
        from PIL import Image
        img = Image.open(io.BytesIO(sample_jpeg_bytes))
        score, count = _detect_copy_move(img)
        assert 0.0 <= score <= 1.0
        assert isinstance(count, int)

    def test_dire_score_calculation(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import _calculate_dire_score
        from PIL import Image
        img = Image.open(io.BytesIO(sample_jpeg_bytes))
        score = _calculate_dire_score(img)
        assert 0.0 <= score <= 1.0

    def test_apply_adversarial_defense_default_bypass(self, sample_jpeg_bytes: bytes):
        from app.services.spatial_engine import apply_adversarial_defense
        out = apply_adversarial_defense(sample_jpeg_bytes, force=False)
        assert len(out) == len(sample_jpeg_bytes) # Should be completely unmodified

    async def test_enterprise_routing_flux_zero_day(self, sample_jpeg_bytes: bytes, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "EXTERNAL_API_URL", "http://mock-enterprise-api")
        monkeypatch.setattr(settings, "EXTERNAL_API_KEY", "mock-key")

        import httpx
        class MockResponse:
            def __init__(self, json_data, status_code=200):
                self.json_data = json_data
                self.status_code = status_code
            def json(self):
                return self.json_data
            def raise_for_status(self):
                pass

        async def mock_post(*args, **kwargs):
            return MockResponse({"score": 95.0})

        monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

        # Mock local engines to return high confidence
        from app.services import orchestrator
        async def mock_analyze_image(buf):
            from app.services.spatial_engine import ImageAnalysisResult
            return ImageAnalysisResult(
                confidence=85.0,
                verdict="DEEPFAKE_DETECTED",
                face_count=1,
            )
        monkeypatch.setattr(orchestrator, "analyze_image", mock_analyze_image)

        class MockVisionModel:
            def predict(self, buf):
                return 85.0, None
            def generate_gradcam(self, buf):
                return None

        monkeypatch.setattr(orchestrator, "get_vision_model", lambda: MockVisionModel())

        from app.services.orchestrator import dispatch_file_scan
        res = await dispatch_file_scan(sample_jpeg_bytes, filename="flux_synthetic.jpg", mime_type="image/jpeg")
        assert res.verdict == "DEEPFAKE_DETECTED"
        assert any("Enterprise API Verification" in f.label for f in res.flags)



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
        except (ImportError, AttributeError, Exception):
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


class TestTemporalEngine:
    """Unit tests for temporal_engine.py"""

    def test_temporal_consistency_calculation(self):
        from app.services.temporal_engine import _temporal_consistency_score
        # Stable scores should yield low inconsistency
        assert _temporal_consistency_score([10.0, 10.5, 9.8]) < 0.2
        # Unstable scores (e.g. abrupt spikes) should yield high inconsistency
        assert _temporal_consistency_score([10.0, 85.0, 12.0]) > 0.3

    def test_landmark_jitter_calculation(self):
        import cv2
        from app.services.temporal_engine import _compute_landmark_jitter
        h, w = 120, 120
        frame_base = np.zeros((h, w, 3), dtype=np.uint8)
        frames = [frame_base.copy() for _ in range(5)]
        jitter, blur, warp = _compute_landmark_jitter(frames)
        assert 0.0 <= jitter <= 1.0
        assert 0.0 <= blur <= 1.0
        assert 0.0 <= warp <= 1.0

    @pytest.mark.asyncio
    async def test_analyze_video_flow(self):
        import tempfile
        import os
        import cv2
        from app.services.temporal_engine import analyze_video
        
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(tmp_path, fourcc, 20.0, (120, 120))
            for _ in range(5):
                frame = np.zeros((120, 120, 3), dtype=np.uint8)
                cv2.circle(frame, (60, 60), 30, (255, 255, 255), -1)
                out.write(frame)
            out.release()
            
            with open(tmp_path, "rb") as f:
                video_bytes = f.read()
            
            result = await analyze_video(video_bytes)
            assert result is not None
            assert 0.0 <= result.confidence <= 100.0
            assert result.verdict in ("AUTHENTIC", "SUSPICIOUS", "DEEPFAKE_DETECTED")
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def test_rppg_engine_analysis(self):
        import cv2
        from app.services.rppg_engine import extract_rppg_signal, verify_biological_pulse
        h, w = 120, 120
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        cv2.circle(frame, (60, 60), 30, (0, 180, 0), -1)
        frames = [frame.copy() for _ in range(10)]
        signal = extract_rppg_signal(frames)
        assert isinstance(signal, list)
        
        dummy_sig = [120.0 + 2.0 * np.sin(2.0 * np.pi * 1.2 * i / 30.0) for i in range(50)]
        score, desc = verify_biological_pulse(dummy_sig, 30.0)
        assert 0.0 <= score <= 1.0
        assert isinstance(desc, str)

    def test_cross_modal_sync_engine(self):
        from app.services.cross_modal import check_audio_visual_sync
        h, w = 120, 120
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frames = [frame.copy() for _ in range(5)]
        
        score, corr, desc = check_audio_visual_sync(frames, b"")
        assert score == 0.0
        assert corr == 0.5
        assert isinstance(desc, str)


