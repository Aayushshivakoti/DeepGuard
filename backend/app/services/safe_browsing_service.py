"""
app/services/safe_browsing_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Google Safe Browsing Lookup API v4 Integration

Checks URLs against Google's threat lists for malware, social
engineering, unwanted software, and potentially harmful applications.
"""
from __future__ import annotations

import structlog
import httpx
from typing import Dict, Any, List, Optional

from app.core.config import settings

log = structlog.get_logger(__name__)

GSB_API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"

THREAT_TYPES = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]


async def check_safe_browsing(url: str) -> Optional[Dict[str, Any]]:
    """
    Check a URL against Google Safe Browsing threat lists.

    Returns None if API key is not configured.
    Returns dict with is_safe, threats list, and threat_types.
    """
    api_key = settings.GOOGLE_SAFE_BROWSING_KEY
    if not api_key or api_key.startswith("your-"):
        log.debug("safe_browsing.skipped", reason="API key not configured")
        return None

    request_body = {
        "client": {
            "clientId": "deepguard-gateway",
            "clientVersion": "3.1.0",
        },
        "threatInfo": {
            "threatTypes": THREAT_TYPES,
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                GSB_API_URL,
                params={"key": api_key},
                json=request_body,
            )

            if response.status_code != 200:
                log.warning("safe_browsing.api_error", status=response.status_code)
                return None

            data = response.json()
            matches = data.get("matches", [])

            if not matches:
                return {
                    "is_safe": True,
                    "threats": [],
                    "threat_types": [],
                    "threat_score": 0.0,
                    "source": "Google Safe Browsing",
                }

            # Extract threat details
            threats = []
            threat_types_found = set()
            for match in matches:
                threat_type = match.get("threatType", "UNKNOWN")
                threat_types_found.add(threat_type)
                threats.append({
                    "threat_type": threat_type,
                    "platform_type": match.get("platformType", "ANY_PLATFORM"),
                    "threat_entry_type": match.get("threatEntryType", "URL"),
                    "cache_duration": match.get("cacheDuration", ""),
                })

            # Score based on threat severity
            severity_scores = {
                "MALWARE": 95,
                "SOCIAL_ENGINEERING": 90,
                "UNWANTED_SOFTWARE": 70,
                "POTENTIALLY_HARMFUL_APPLICATION": 60,
            }
            max_score = max(severity_scores.get(t, 50) for t in threat_types_found)

            return {
                "is_safe": False,
                "threats": threats,
                "threat_types": list(threat_types_found),
                "threat_score": float(max_score),
                "source": "Google Safe Browsing",
            }

    except httpx.TimeoutException:
        log.warning("safe_browsing.timeout", url=url)
        return None
    except Exception as e:
        log.error("safe_browsing.error", url=url, error=str(e))
        return None


async def check_urls_batch(urls: List[str]) -> Dict[str, Any]:
    """Check multiple URLs in a single API call."""
    api_key = settings.GOOGLE_SAFE_BROWSING_KEY
    if not api_key or api_key.startswith("your-"):
        return {url: None for url in urls}

    request_body = {
        "client": {
            "clientId": "deepguard-gateway",
            "clientVersion": "3.1.0",
        },
        "threatInfo": {
            "threatTypes": THREAT_TYPES,
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": u} for u in urls],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GSB_API_URL,
                params={"key": api_key},
                json=request_body,
            )

            if response.status_code != 200:
                return {url: None for url in urls}

            data = response.json()
            matches = data.get("matches", [])

            # Map matches back to URLs
            results = {url: {"is_safe": True, "threats": []} for url in urls}
            for match in matches:
                matched_url = match.get("threat", {}).get("url", "")
                if matched_url in results:
                    results[matched_url]["is_safe"] = False
                    results[matched_url]["threats"].append(match.get("threatType", "UNKNOWN"))

            return results

    except Exception as e:
        log.error("safe_browsing.batch_error", error=str(e))
        return {url: None for url in urls}
