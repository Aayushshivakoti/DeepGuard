"""
app/services/zerogpt_client.py — ZeroGPT API Client Wrapper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provides asynchronous verification of AI-generated text content, email
bodies, OCR extractions, and phishing descriptions via ZeroGPT API.
"""
from __future__ import annotations

import structlog
import httpx
from typing import Any, Dict

from app.core.config import settings

log = structlog.get_logger(__name__)


class ZeroGPTClient:
    """Asynchronous client for ZeroGPT AI Text Detection API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.ZEROGPT_API_KEY
        self.timeout = settings.EXTERNAL_API_TIMEOUT_SEC

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def detect_ai_text(self, text: str) -> Dict[str, Any]:
        """
        Query ZeroGPT API to evaluate AI generation percentage in text.
        """
        if not self.is_configured:
            log.debug("zerogpt.unconfigured", msg="ZEROGPT_API_KEY is not configured")
            return {
                "available": False,
                "score": 0.0,
                "fake_percentage": 0.0,
                "is_human": True,
                "words_count": 0,
                "feedback": "ZeroGPT API unconfigured",
            }

        if not text or len(text.strip()) < 20:
            return {
                "available": True,
                "score": 0.0,
                "fake_percentage": 0.0,
                "is_human": True,
                "words_count": len(text.split()),
                "feedback": "Text snippet too short for reliable ZeroGPT analysis",
            }

        url = "https://api.zerogpt.com/api/detect/detectText"
        headers = {
            "ApiKey": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {"input_text": text[:10000]}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code != 200:
                    log.warning("zerogpt.http_error", status_code=resp.status_code, body=resp.text[:200])
                    return {
                        "available": False,
                        "score": 0.0,
                        "fake_percentage": 0.0,
                        "is_human": True,
                        "words_count": 0,
                        "feedback": f"ZeroGPT HTTP error {resp.status_code}",
                    }

                data = resp.json()
                if not isinstance(data, dict):
                    data = {}
                data_obj = data.get("data", data)
                if not isinstance(data_obj, dict):
                    data_obj = {}

                raw_fake = data_obj.get("fakePercentage", data_obj.get("completelyGeneratedProb", 0.0))
                try:
                    fake_percentage = float(raw_fake)
                except (ValueError, TypeError):
                    fake_percentage = 0.0

                score = max(0.0, min(1.0, fake_percentage / 100.0 if fake_percentage > 1.0 else fake_percentage))
                feedback = str(data_obj.get("feedback", "ZeroGPT Text Analysis"))
                
                raw_words = data_obj.get("textWords", len(text.split()))
                try:
                    words_count = int(raw_words)
                except (ValueError, TypeError):
                    words_count = len(text.split())

                return {
                    "available": True,
                    "score": score,
                    "fake_percentage": score * 100.0,
                    "is_human": score < 0.5,
                    "words_count": words_count,
                    "feedback": feedback,
                }

        except Exception as exc:
            log.warning("zerogpt.request_failed", error=str(exc))
            return {
                "available": False,
                "score": 0.0,
                "fake_percentage": 0.0,
                "is_human": True,
                "words_count": 0,
                "feedback": f"ZeroGPT request exception: {str(exc)}",
            }


# Global instance helper
zerogpt_client = ZeroGPTClient()
