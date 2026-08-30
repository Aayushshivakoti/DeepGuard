from __future__ import annotations

import anyio
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
    log.info(
        "external_api_client.query",
        filename=filename,
        url=settings.EXTERNAL_API_URL,
    )
    # Simulate network latency – in a real client this would be an HTTP request.
    await anyio.sleep(0.01)

    # Simple heuristic: treat known synthetic model names as high risk.
    low_name = filename.lower()
    if any(tag in low_name for tag in ("synthetic", "flux", "sd3", "midjourney")):
        return 92.5
    return 75.0
