"""
app/services/gemini_client.py — Google Gemini Multimodal API Client
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provides asynchronous evaluation of image/video frames and phishing text
using Google Gemini API (gemini-2.5-flash / gemini-1.5-pro) via official
Google GenAI SDK (google-genai) with httpx REST API fallback.
"""
from __future__ import annotations

import base64
import json
import anyio
import structlog
import httpx
from typing import Any, Dict, List, Optional

from app.core.config import settings

log = structlog.get_logger(__name__)

# Check for official Google GenAI SDK
try:
    from google import genai
    from google.genai import types
    GENAI_SDK_AVAILABLE = True
except ImportError:
    GENAI_SDK_AVAILABLE = False


class GeminiClient:
    """Asynchronous client for Google Gemini API."""

    def __init__(self, api_key: str | None = None, model_version: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_version = model_version or settings.GEMINI_MODEL_VERSION
        self.timeout = settings.EXTERNAL_API_TIMEOUT_SEC

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def analyze_multimodal_media(
        self,
        buffer: bytes,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Analyze an image or media buffer using Gemini Multimodal vision capabilities.
        Uses Google GenAI SDK if available, falling back to httpx REST API.
        Returns structured analysis including deepfake probability score, flags, and reasoning.
        """
        if not self.is_configured:
            log.debug("gemini.unconfigured", msg="GEMINI_API_KEY is not configured")
            return {
                "available": False,
                "score": 0.0,
                "confidence": 0.0,
                "is_ai_generated": False,
                "reasoning": "Gemini API unconfigured",
                "flags": [],
            }

        prompt = (
            "You are an expert forensic deepfake and media authentication analyst for DeepGuard. "
            "Examine this media carefully for signs of AI generation, facial swapping, GAN/diffusion artifacts, "
            "lighting inconsistencies, boundary blur, or synthetic textures. "
            "Respond ONLY with a raw JSON object containing the following keys:\n"
            "{\n"
            '  "deepfake_score": float between 0.0 (authentic) and 1.0 (synthetic),\n'
            '  "is_ai_generated": boolean,\n'
            '  "confidence": float between 0.0 and 100.0,\n'
            '  "reasoning": "brief technical forensic summary",\n'
            '  "flags": ["flag 1", "flag 2"]\n'
            "}"
        )

        # ── 1. Try Google GenAI SDK execution if available ────────────────────
        if GENAI_SDK_AVAILABLE:
            try:
                def _run_sdk():
                    client = genai.Client(api_key=self.api_key)
                    part = types.Part.from_bytes(data=buffer, mime_type=mime_type)
                    config = types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                    )
                    resp = client.models.generate_content(
                        model=self.model_version,
                        contents=[prompt, part],
                        config=config,
                    )
                    return resp.text

                text_content = await anyio.to_thread.run_sync(_run_sdk)
                parsed = self._parse_json_response(text_content)
                score = float(parsed.get("deepfake_score", 0.0))
                score = max(0.0, min(1.0, score))
                confidence = float(parsed.get("confidence", score * 100.0))

                return {
                    "available": True,
                    "score": score,
                    "confidence": confidence,
                    "is_ai_generated": bool(parsed.get("is_ai_generated", score > 0.5)),
                    "reasoning": str(parsed.get("reasoning", "Gemini forensic multimodal evaluation")),
                    "flags": parsed.get("flags", []),
                }
            except Exception as exc:
                log.warning("gemini.sdk_failed_falling_back_to_rest", error=str(exc))

        # ── 2. Direct REST API Fallback ─────────────────────────────────────────
        b64_data = base64.b64encode(buffer).decode("utf-8")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_version}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    log.warning("gemini.http_error", status_code=resp.status_code, body=resp.text[:300])
                    return {
                        "available": False,
                        "score": 0.0,
                        "confidence": 0.0,
                        "is_ai_generated": False,
                        "reasoning": f"Gemini HTTP error {resp.status_code}",
                        "flags": [],
                    }

                res_json = resp.json()
                text_content = (
                    res_json.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )

                parsed = self._parse_json_response(text_content)
                score = float(parsed.get("deepfake_score", 0.0))
                score = max(0.0, min(1.0, score))
                confidence = float(parsed.get("confidence", score * 100.0))

                return {
                    "available": True,
                    "score": score,
                    "confidence": confidence,
                    "is_ai_generated": bool(parsed.get("is_ai_generated", score > 0.5)),
                    "reasoning": str(parsed.get("reasoning", "Gemini forensic multimodal evaluation")),
                    "flags": parsed.get("flags", []),
                }

        except Exception as exc:
            log.warning("gemini.request_failed", error=str(exc))
            return {
                "available": False,
                "score": 0.0,
                "confidence": 0.0,
                "is_ai_generated": False,
                "reasoning": f"Gemini request exception: {str(exc)}",
                "flags": [],
            }

    async def analyze_text_content(self, text: str) -> Dict[str, Any]:
        """
        Analyze text/email content for AI generation and phishing intent using Gemini.
        Uses Google GenAI SDK if available, falling back to httpx REST API.
        """
        if not self.is_configured:
            return {
                "available": False,
                "phishing_score": 0.0,
                "ai_text_score": 0.0,
                "reasoning": "Gemini API unconfigured",
                "flags": [],
            }

        prompt = (
            "Analyze the following text for phishing intent, urgency tactics, social engineering, and AI generation features. "
            "Respond ONLY with a valid JSON object:\n"
            "{\n"
            '  "phishing_score": float between 0.0 and 1.0,\n'
            '  "ai_text_score": float between 0.0 and 1.0,\n'
            '  "reasoning": "brief summary",\n'
            '  "flags": ["flag 1"]\n'
            "}\n\n"
            f"TEXT TO ANALYZE:\n{text[:4000]}"
        )

        # ── 1. SDK Execution ──────────────────────────────────────────────────
        if GENAI_SDK_AVAILABLE:
            try:
                def _run_text_sdk():
                    client = genai.Client(api_key=self.api_key)
                    config = types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                    )
                    resp = client.models.generate_content(
                        model=self.model_version,
                        contents=[prompt],
                        config=config,
                    )
                    return resp.text

                text_content = await anyio.to_thread.run_sync(_run_text_sdk)
                parsed = self._parse_json_response(text_content)
                return {
                    "available": True,
                    "phishing_score": float(parsed.get("phishing_score", 0.0)),
                    "ai_text_score": float(parsed.get("ai_text_score", 0.0)),
                    "reasoning": str(parsed.get("reasoning", "Gemini text analysis")),
                    "flags": parsed.get("flags", []),
                }
            except Exception as exc:
                log.warning("gemini.text_sdk_failed_falling_back_to_rest", error=str(exc))

        # ── 2. Direct REST Fallback ───────────────────────────────────────────
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_version}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    return {
                        "available": False,
                        "phishing_score": 0.0,
                        "ai_text_score": 0.0,
                        "reasoning": f"Gemini HTTP error {resp.status_code}",
                        "flags": [],
                    }

                res_json = resp.json()
                text_content = (
                    res_json.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = self._parse_json_response(text_content)
                return {
                    "available": True,
                    "phishing_score": float(parsed.get("phishing_score", 0.0)),
                    "ai_text_score": float(parsed.get("ai_text_score", 0.0)),
                    "reasoning": str(parsed.get("reasoning", "Gemini text analysis")),
                    "flags": parsed.get("flags", []),
                }
        except Exception as exc:
            log.warning("gemini.text_request_failed", error=str(exc))
            return {
                "available": False,
                "phishing_score": 0.0,
                "ai_text_score": 0.0,
                "reasoning": f"Gemini text exception: {str(exc)}",
                "flags": [],
            }

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """Robustly parse JSON from Gemini text response."""
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        try:
            return json.loads(content)
        except Exception:
            import re
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
            return {}


# Global instance helper
gemini_client = GeminiClient()
