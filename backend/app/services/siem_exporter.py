"""
app/services/siem_exporter.py — Live SIEM Event Forwarder

Exports security events (CEF/Syslog formatted) to:
  1. Splunk HEC (HTTP Event Collector)
  2. Elasticsearch
  3. Datadog Logs API
"""
from __future__ import annotations

import json
import time
from typing import Dict, Any, Optional

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


async def forward_siem_event(
    event_data: Dict[str, Any],
    secret_key: Optional[str] = None,
) -> bool:
    """
    Forward security audit event to configured SIEM endpoints.

    Supports Splunk HEC, Elasticsearch, and Datadog concurrently if configured.
    """
    success = True

    # 1. Forward to Splunk HEC if configured
    splunk_url = getattr(settings, "SPLUNK_HEC_URL", "")
    splunk_token = getattr(settings, "SPLUNK_HEC_TOKEN", "")
    if splunk_url and splunk_token:
        try:
            # Splunk HEC expects a wrapper JSON with "event" key
            payload = {
                "time": event_data.get("timestamp", int(time.time())),
                "host": "deepguard-gateway",
                "source": "gateway-audit",
                "sourcetype": "_json",
                "event": event_data,
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    splunk_url,
                    headers={"Authorization": f"Splunk {splunk_token}"},
                    json=payload,
                )
                if res.status_code >= 300:
                    log.warning("siem.splunk_hec_non_success", status=res.status_code)
                    success = False
                else:
                    log.info("siem.splunk_hec_delivered")
        except Exception as e:
            log.error("siem.splunk_hec_failed", error=str(e))
            success = False

    # 2. Forward to Elasticsearch if configured
    es_url = getattr(settings, "ELASTICSEARCH_URL", "")
    es_api_key = getattr(settings, "ELASTICSEARCH_API_KEY", "")
    if es_url:
        try:
            headers = {"Content-Type": "application/json"}
            if es_api_key:
                headers["Authorization"] = f"ApiKey {es_api_key}"

            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    f"{es_url}/deepguard-audit-logs/_doc",
                    headers=headers,
                    json=event_data,
                )
                if res.status_code >= 300:
                    log.warning("siem.elasticsearch_non_success", status=res.status_code)
                    success = False
                else:
                    log.info("siem.elasticsearch_delivered")
        except Exception as e:
            log.error("siem.elasticsearch_failed", error=str(e))
            success = False

    # 3. Forward to Datadog Logs API if configured
    dd_url = getattr(settings, "DATADOG_LOGS_URL", "https://http-intake.logs.datadoghq.com/api/v2/logs")
    dd_api_key = getattr(settings, "DATADOG_API_KEY", "")
    if dd_api_key:
        try:
            payload = {
                "ddsource": "deepguard",
                "ddtags": f"env:{settings.APP_ENV}",
                "hostname": "deepguard-gateway",
                "message": json.dumps(event_data),
                "service": "gateway-forensics",
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(
                    dd_url,
                    headers={"DD-API-KEY": dd_api_key, "Content-Type": "application/json"},
                    json=payload,
                )
                if res.status_code >= 300:
                    log.warning("siem.datadog_non_success", status=res.status_code)
                    success = False
                else:
                    log.info("siem.datadog_delivered")
        except Exception as e:
            log.error("siem.datadog_failed", error=str(e))
            success = False

    log.info("siem.forward_complete", success=success)
    return success
