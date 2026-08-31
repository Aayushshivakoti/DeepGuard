"""
app/services/huggingface_client.py — Hugging Face Inference API Client
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provides asynchronous querying of state-of-the-art open-source Vision
Transformer (ViT) and deepfake classification models hosted on Hugging Face.
"""
from __future__ import annotations

import structlog
import httpx
from typing import Any, Dict, List

from app.core.config import settings

log = structlog.get_logger(__name__)


class HuggingFaceClient:
    """Asynchronous client for Hugging Face Inference API."""

    def __init__(
        self,
        api_key: str | None = None,
        model_endpoint: str | None = None,
    ):
        self.api_key = api_key or settings.HUGGINGFACE_API_KEY
        self.endpoint = model_endpoint or settings.HUGGINGFACE_MODEL_ENDPOINT
        self.timeout = settings.EXTERNAL_API_TIMEOUT_SEC

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def classify_image_deepfake(self, buffer: bytes) -> Dict[str, Any]:
        """
        Query Vision Transformer deepfake model on Hugging Face Inference API.
        """
        if not self.is_configured:
            log.debug("huggingface.unconfigured", msg="HUGGINGFACE_API_KEY is not configured")
            return {
                "available": False,
                "score": 0.0,
                "confidence": 0.0,
                "top_label": "Unconfigured",
                "raw_predictions": [],
                "reasoning": "Hugging Face API unconfigured",
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/octet-stream",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.endpoint, content=buffer, headers=headers)
                if resp.status_code != 200:
                    log.warning("huggingface.http_error", status_code=resp.status_code, body=resp.text[:200])
                    reasoning_msg = f"Hugging Face HTTP error {resp.status_code}"
                    if resp.status_code == 503:
                        try:
                            err_body = resp.json()
                            est = err_body.get("estimated_time", None)
                            if est:
                                reasoning_msg = f"Hugging Face model cold-start initializing (estimated {est:.1f}s)"
                        except Exception:
                            pass
                    return {
                        "available": False,
                        "score": 0.0,
                        "confidence": 0.0,
                        "top_label": "HTTP_Error" if resp.status_code != 503 else "Model_Loading",
                        "raw_predictions": [],
                        "reasoning": reasoning_msg,
                    }

                predictions = resp.json()
                if not isinstance(predictions, list):
                    # Handle nested lists if returned
                    predictions = predictions.get("predictions", []) if isinstance(predictions, dict) else []

                deepfake_score = 0.0
                top_label = "unknown"
                highest_score = 0.0

                for item in predictions:
                    if not isinstance(item, dict):
                        continue
                    label = str(item.get("label", "")).lower()
                    score = float(item.get("score", 0.0))

                    if score > highest_score:
                        highest_score = score
                        top_label = item.get("label", "")

                    if any(term in label for term in ["fake", "ai", "synthetic", "deepfake", "generated", "manipulated"]):
                        deepfake_score = max(deepfake_score, score)

                # Fallback score if top label is fake
                if any(term in top_label.lower() for term in ["fake", "ai", "synthetic", "deepfake"]):
                    deepfake_score = max(deepfake_score, highest_score)

                return {
                    "available": True,
                    "score": deepfake_score,
                    "confidence": deepfake_score * 100.0,
                    "top_label": top_label,
                    "raw_predictions": predictions,
                    "reasoning": f"HuggingFace ViT Classification: Top Label '{top_label}' ({highest_score:.2f})",
                }

        except Exception as exc:
            log.warning("huggingface.request_failed", error=str(exc))
            return {
                "available": False,
                "score": 0.0,
                "confidence": 0.0,
                "top_label": "Exception",
                "raw_predictions": [],
                "reasoning": f"Hugging Face request exception: {str(exc)}",
            }


# Global instance helper
huggingface_client = HuggingFaceClient()
