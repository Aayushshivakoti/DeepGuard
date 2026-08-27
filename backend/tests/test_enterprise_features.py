"""
tests/test_enterprise_features.py — Unit Tests for Enterprise Security & Optimization Features
"""
from __future__ import annotations

import io
import pytest
from PIL import Image
import numpy as np

pytestmark = pytest.mark.asyncio


class TestEnterpriseFeatures:
    """Unit tests for the implemented enterprise additions."""

    async def test_adversarial_defense_runs_cleanly(self, sample_jpeg_bytes: bytes):
        """Test that apply_adversarial_defense successfully processes image bytes without errors."""
        from app.services.spatial_engine import apply_adversarial_defense
        
        defended_bytes = apply_adversarial_defense(sample_jpeg_bytes)
        assert defended_bytes is not None
        assert len(defended_bytes) > 0
        
        # Verify it is still a valid image
        img = Image.open(io.BytesIO(defended_bytes))
        assert img.format == "JPEG"

    async def test_perceptual_hash_deduplication(self, sample_jpeg_bytes: bytes):
        """Test that perceptual hashing deduplicates duplicate scans instantly via cache."""
        from app.services.orchestrator import dispatch_file_scan
        from app.services.reverse_image_service import lookup_cached_response, PHASH_RESPONSE_CACHE
        
        # Clear the cache first to ensure a fresh test environment
        PHASH_RESPONSE_CACHE.clear()
        
        # First scan: executes full pipeline
        response1 = await dispatch_file_scan(sample_jpeg_bytes, "original.jpg", "image/jpeg")
        assert response1 is not None
        
        # Verify response was stored in cache
        assert len(PHASH_RESPONSE_CACHE) == 1
        
        # Second scan (identical bytes): must return cached response instantly
        response2 = await dispatch_file_scan(sample_jpeg_bytes, "duplicate.jpg", "image/jpeg")
        assert response2 is not None
        
        # Confirm they share the same confidence but have unique request IDs and "Cache Deduplication Match" flag
        assert response1.confidence == response2.confidence
        assert response1.id != response2.id
        
        flag_labels = [f.label for f in response2.flags]
        assert "Cache Deduplication Match" in flag_labels

    async def test_cross_modal_alignment_keys(self):
        """Test that cross modal analysis outputs cross_modal_mismatch_score and is_audio_visual_aligned."""
        from app.ml_models.cross_modal import CrossModalConsistencyChecker
        
        checker = CrossModalConsistencyChecker()
        # Successful empty arrays compute correlation=0.0, consistency=0.0 -> mismatch=100.0, aligned=False
        result = checker.analyze([], b"")
        assert "cross_modal_mismatch_score" in result
        assert "is_audio_visual_aligned" in result
        assert result["cross_modal_mismatch_score"] == 100.0
        assert result["is_audio_visual_aligned"] is False

    async def test_phishing_payload_scanner(self, monkeypatch):
        """Test that the phishing payload check detects and flags downloadable executable/PDF headers."""
        from app.services.phishing_engine import analyze_url
        import httpx
        
        # Mock httpx client head call to simulate downloading an executable
        class MockHeaders:
            def __init__(self, headers_dict):
                self.headers = headers_dict
                self.status_code = 200
        
        async def mock_head(*args, **kwargs):
            return MockHeaders({
                "content-type": "application/x-msdownload",
                "content-disposition": 'attachment; filename="malware.exe"'
            })
            
        monkeypatch.setattr(httpx.AsyncClient, "head", mock_head)
        
        # Trigger URL scan on suspicious URL
        result = await analyze_url("http://dangerous-download-portal.xyz/installer.exe")
        assert result is not None
        assert result.engine_metadata.get("sandbox_status") == "SUSPICIOUS_PAYLOAD_DETECTED"
        assert result.confidence >= 30.0  # Boosted by the +30 payload penalty
        
        flag_labels = [f.label for f in result.flags]
        assert "Suspicious File Payload Download" in flag_labels
