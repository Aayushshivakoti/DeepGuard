"""
tests/test_scan_api.py — Integration Tests for Scan Endpoints
"""
from __future__ import annotations

import io
import pytest
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


class TestFileScanEndpoint:
    """Tests for POST /api/v1/scan/file"""

    async def test_scan_jpeg_returns_200(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test_image.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        assert response.status_code == 200

    async def test_scan_response_has_required_fields(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "verdict" in data
        assert "confidence" in data
        assert "media_type" in data
        assert "flags" in data
        assert "processing_time_ms" in data
        assert "timestamp" in data

    async def test_verdict_is_valid_enum(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        data = response.json()
        assert data["verdict"] in (
            "AUTHENTIC", "SUSPICIOUS", "DEEPFAKE_DETECTED", "PHISHING_DETECTED"
        )

    async def test_confidence_is_in_range(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        data = response.json()
        assert 0.0 <= data["confidence"] <= 100.0

    async def test_png_upload(self, client: AsyncClient, sample_png_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.png", sample_png_bytes, "image/png")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["media_type"] == "image"

    async def test_unsupported_mime_returns_415(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.exe", b"MZ\x90\x00", "application/x-msdownload")},
        )
        assert response.status_code == 415

    async def test_no_filename_returns_400(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("", b"data", "image/jpeg")},
        )
        assert response.status_code in (400, 422)

    async def test_flags_are_list(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("test.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        data = response.json()
        assert isinstance(data["flags"], list)
        for flag in data["flags"]:
            assert "label" in flag
            assert "severity" in flag
            assert "description" in flag

    async def test_wav_audio_upload(self, client: AsyncClient, sample_wav_bytes: bytes):
        response = await client.post(
            "/api/v1/scan/file",
            files={"file": ("voice.wav", sample_wav_bytes, "audio/wav")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["media_type"] == "audio"


class TestUrlScanEndpoint:
    """Tests for POST /api/v1/scan/url"""

    async def test_phishing_url_detected(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/url",
            json={"url": "http://paypa1-secure-login.xyz/account"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["verdict"] in ("PHISHING_DETECTED", "SUSPICIOUS")
        assert data["confidence"] > 20.0

    async def test_safe_url_lower_confidence(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/url",
            json={"url": "https://www.google.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["confidence"] < 60.0

    async def test_url_response_schema(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/url",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "verdict" in data
        assert "flags" in data
        assert data["media_type"] == "url"

    async def test_ip_url_flagged(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/url",
            json={"url": "http://93.184.216.34/login"},
        )
        assert response.status_code == 200
        data = response.json()
        flag_labels = [f["label"] for f in data["flags"]]
        assert any("IP" in label for label in flag_labels)

    async def test_suspicious_tld_flagged(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/scan/url",
            json={"url": "https://example.xyz"},
        )
        data = response.json()
        flag_labels = [f["label"] for f in data["flags"]]
        assert any("TLD" in label or "Domain" in label for label in flag_labels)


class TestScanHistoryEndpoint:
    """Tests for GET /api/v1/scan/history"""

    async def test_history_returns_list(self, client: AsyncClient):
        response = await client.get("/api/v1/scan/history")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_history_after_scan(self, client: AsyncClient, sample_jpeg_bytes: bytes):
        # First scan
        await client.post(
            "/api/v1/scan/file",
            files={"file": ("hist_test.jpg", sample_jpeg_bytes, "image/jpeg")},
        )
        # Then check history
        response = await client.get("/api/v1/scan/history?limit=5")
        assert response.status_code == 200
