"""
app/services/alert_bot.py — ChatOps Alert Dispatcher
Sends live alerts to Slack, Discord, and Microsoft Teams.
"""
from __future__ import annotations

from typing import Dict, Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

async def dispatch_chat_alert(
    event_type: str,
    verdict: str,
    confidence: float,
    details: Dict[str, Any],
) -> bool:
    """
    Dispatch critical incident notifications to Slack, Discord, or Teams channel webhooks.
    """
    success = True
    
    # 1. Slack Integration
    slack_webhook = getattr(settings, "SLACK_WEBHOOK_URL", "")
    if slack_webhook:
        try:
            payload = {
                "text": f"🚨 *DeepGuard Security Incident Alert*\n"
                        f"*Event:* {event_type}\n"
                        f"*Verdict:* {verdict}\n"
                        f"*Confidence:* {confidence}%\n"
                        f"*Meta:* {details.get('filename') or details.get('url')}"
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(slack_webhook, json=payload)
                if res.status_code >= 300:
                    success = False
        except Exception as e:
            log.error("alert_bot.slack_failed", error=str(e))
            success = False

    # 2. Discord Integration
    discord_webhook = getattr(settings, "DISCORD_WEBHOOK_URL", "")
    if discord_webhook:
        try:
            payload = {
                "content": f"🚨 **DeepGuard Security Incident Alert**\n"
                           f"**Event:** {event_type}\n"
                           f"**Verdict:** {verdict}\n"
                           f"**Confidence:** {confidence}%\n"
                           f"**Resource:** {details.get('filename') or details.get('url')}"
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(discord_webhook, json=payload)
                if res.status_code >= 300:
                    success = False
        except Exception as e:
            log.error("alert_bot.discord_failed", error=str(e))
            success = False

    # 3. MS Teams Integration
    teams_webhook = getattr(settings, "TEAMS_WEBHOOK_URL", "")
    if teams_webhook:
        try:
            payload = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "summary": "DeepGuard Security Incident Alert",
                "themeColor": "FF0000",
                "sections": [{
                    "activityTitle": "DeepGuard Incident Alert",
                    "facts": [
                        {"name": "Event Type", "value": event_type},
                        {"name": "Verdict", "value": verdict},
                        {"name": "Confidence", "value": f"{confidence}%"},
                        {"name": "Target", "value": details.get("filename") or details.get("url") or "Unknown"}
                    ]
                }]
            }
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(teams_webhook, json=payload)
                if res.status_code >= 300:
                    success = False
        except Exception as e:
            log.error("alert_bot.teams_failed", error=str(e))
            success = False

    return success
