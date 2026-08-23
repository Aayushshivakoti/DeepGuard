"""
app/services/virustotal_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VirusTotal v3 API Integration

Submits URLs for scanning and retrieves analysis reports including
detection ratios, engine verdicts, and threat categories. Degrades
gracefully when VIRUSTOTAL_API_KEY is not configured.
"""
from __future__ import annotations

import base64
import structlog
import httpx
from typing import Dict, Any, Optional

from app.core.config import settings

log = structlog.get_logger(__name__)

VT_API_BASE = "https://www.virustotal.com/api/v3"


async def scan_url_virustotal(url: str) -> Optional[Dict[str, Any]]:
    """
    Submit a URL to VirusTotal for analysis and retrieve the report.

    Returns None if API key is not configured or request fails.
    Returns dict with detection_ratio, engine_results, threat_categories.
    """
    api_key = settings.VIRUSTOTAL_API_KEY
    if not api_key or api_key.startswith("your-"):
        log.debug("virustotal.skipped", reason="API key not configured")
        return None

    headers = {"x-apikey": api_key}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Submit URL for scanning
            submit_resp = await client.post(
                f"{VT_API_BASE}/urls",
                headers=headers,
                data={"url": url},
            )

            if submit_resp.status_code == 200:
                analysis_id = submit_resp.json().get("data", {}).get("id")
                log.info("virustotal.url_submitted", url=url, analysis_id=analysis_id)
            elif submit_resp.status_code == 429:
                log.warning("virustotal.rate_limited")
                return {"error": "VirusTotal rate limit exceeded", "status": "RATE_LIMITED"}
            else:
                log.warning("virustotal.submit_failed", status=submit_resp.status_code)

            # Step 2: Get URL report (may use cached result)
            url_id = base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")
            report_resp = await client.get(
                f"{VT_API_BASE}/urls/{url_id}",
                headers=headers,
            )

            if report_resp.status_code != 200:
                log.warning("virustotal.report_not_found", status=report_resp.status_code)
                return None

            data = report_resp.json().get("data", {})
            attrs = data.get("attributes", {})
            stats = attrs.get("last_analysis_stats", {})
            results = attrs.get("last_analysis_results", {})

            total_engines = sum(stats.values())
            malicious = stats.get("malicious", 0)
            suspicious = stats.get("suspicious", 0)

            # Extract top engine verdicts
            engine_verdicts = []
            for engine_name, result in list(results.items())[:10]:
                if result.get("category") in ("malicious", "suspicious"):
                    engine_verdicts.append({
                        "engine": engine_name,
                        "category": result.get("category"),
                        "result": result.get("result", ""),
                    })

            threat_score = ((malicious + suspicious) / max(total_engines, 1)) * 100.0

            return {
                "detection_ratio": f"{malicious + suspicious}/{total_engines}",
                "malicious_count": malicious,
                "suspicious_count": suspicious,
                "total_engines": total_engines,
                "threat_score": round(threat_score, 2),
                "engine_verdicts": engine_verdicts[:5],
                "categories": attrs.get("categories", {}),
                "reputation": attrs.get("reputation", 0),
                "last_analysis_date": attrs.get("last_analysis_date"),
                "source": "VirusTotal",
            }

    except httpx.TimeoutException:
        log.warning("virustotal.timeout", url=url)
        return {"error": "VirusTotal request timed out", "status": "TIMEOUT"}
    except Exception as e:
        log.error("virustotal.error", url=url, error=str(e))
        return None
