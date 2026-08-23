"""
app/services/webhook_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Webhook & Alert Dispatcher Service

Dispatches cryptographic HTTP POST webhook payloads and alert notifications
when scheduled monitors or real-time scans detect phishing threats or deepfakes.
Uses real httpx async HTTP client with retry logic.
"""
import hmac
import hashlib
import json
import time
import structlog
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings

log = structlog.get_logger(__name__)


async def dispatch_webhook(
    webhook_url: str,
    event_type: str,
    payload: Dict[str, Any],
    secret_key: Optional[str] = None,
    max_retries: int = 3,
) -> bool:
    """
    Dispatch signed JSON HTTP POST payload to user-configured webhook URL.

    Uses HMAC-SHA256 signature from settings.WEBHOOK_HMAC_SECRET.
    Retries up to max_retries times on transient failures.
    """
    if secret_key is None:
        secret_key = settings.WEBHOOK_HMAC_SECRET

    try:
        data = {
            "event": event_type,
            "timestamp": int(time.time()),
            "payload": payload,
        }
        json_bytes = json.dumps(data, default=str).encode("utf-8")
        
        # Calculate HMAC signature
        signature = hmac.new(
            secret_key.encode("utf-8"),
            json_bytes,
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-DeepGuard-Signature": f"sha256={signature}",
            "X-DeepGuard-Event": event_type,
            "User-Agent": "DeepGuard-Webhook/3.1",
        }

        # Retry loop with exponential backoff
        last_error = None
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        webhook_url,
                        content=json_bytes,
                        headers=headers,
                    )

                    if response.status_code < 300:
                        log.info(
                            "webhook.delivered",
                            url=webhook_url,
                            event=event_type,
                            status=response.status_code,
                            attempt=attempt + 1,
                        )
                        return True

                    log.warning(
                        "webhook.non_success_status",
                        url=webhook_url,
                        status=response.status_code,
                        attempt=attempt + 1,
                    )
                    last_error = f"HTTP {response.status_code}"

            except httpx.TimeoutException:
                last_error = "timeout"
                log.warning("webhook.timeout", url=webhook_url, attempt=attempt + 1)
            except httpx.ConnectError:
                last_error = "connection_refused"
                log.warning("webhook.connect_error", url=webhook_url, attempt=attempt + 1)
            except Exception as e:
                last_error = str(e)
                log.warning("webhook.attempt_failed", url=webhook_url, error=str(e), attempt=attempt + 1)

            # Exponential backoff
            if attempt < max_retries - 1:
                import asyncio
                await asyncio.sleep(2 ** attempt)

        log.error("webhook.all_retries_failed", url=webhook_url, event=event_type,
                  last_error=last_error, attempts=max_retries)
        return False

    except Exception as exc:
        log.error("webhook.dispatch_failed", url=webhook_url, error=str(exc))
        return False
