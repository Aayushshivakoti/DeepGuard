from __future__ import annotations

import anyio
import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

async def query_external_api(buffer: bytes, filename: str) -> float:
    """
    Stub integration client for an external enterprise detection API.
    Simulates remote API round‑trip analysis with minimal latency.
    The function respects the ``EXTERNAL_API_URL`` and ``EXTERNAL_API_KEY``
    configuration values, but they are not used in this mock implementation.
    """
    if not settings.EXTERNAL_API_URL or not settings.EXTERNAL_API_KEY:
        raise ValueError("External API configuration missing")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.EXTERNAL_API_URL}/v1/analyze",
            headers={"X-API-KEY": settings.EXTERNAL_API_KEY},
            files={"file": (filename, buffer)},
            timeout=10.0,
        )
        response.raise_for_status()
        return float(response.json()["score"])
