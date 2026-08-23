"""
app/services/soar_service.py — Automated SOAR Mitigation Playbooks Engine

Integrates with:
  1. AWS WAFv2 — Adds IP addresses to an IP Set for automated blocking.
  2. Cloudflare Firewall — Injects IP access rules to block threat actors.
"""
from __future__ import annotations

import structlog
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings

log = structlog.get_logger(__name__)


async def execute_soar_playbook(
    target_ip_or_domain: str,
    confidence_score: float,
    provider: str = "AWS_WAF",
) -> Dict[str, Any]:
    """
    Automated Security Orchestration, Automation, and Response (SOAR).
    Injects IP/Domain block rules if scan score >= 90%.
    """
    triggered = confidence_score >= 90.0
    rule_id = f"rule_block_{hash(target_ip_or_domain) & 0xffffffff:08x}"
    status_str = "INACTIVE"

    if triggered:
        log.info(
            "soar.firewall_rule_triggered",
            target=target_ip_or_domain,
            provider=provider,
            confidence=confidence_score
        )

        if provider == "AWS_WAF":
            status_str = await _inject_aws_waf_rule(target_ip_or_domain, rule_id)
        elif provider == "CLOUDFLARE":
            status_str = await _inject_cloudflare_rule(target_ip_or_domain)
        else:
            status_str = "ACTIVE_SIMULATED"

    return {
        "triggered": triggered,
        "action": "BLOCK_RULE_INJECTED" if triggered else "MONITOR_ONLY",
        "provider": provider,
        "rule_id": rule_id,
        "target": target_ip_or_domain,
        "status": status_str
    }


async def _inject_aws_waf_rule(ip_address: str, rule_id: str) -> str:
    """Inject IP block rule into AWS WAFv2 IPSet."""
    aws_access_key = getattr(settings, "AWS_ACCESS_KEY_ID", "")
    aws_secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    waf_ipset_id = getattr(settings, "AWS_WAF_IPSET_ID", "")
    waf_ipset_name = getattr(settings, "AWS_WAF_IPSET_NAME", "")
    waf_scope = getattr(settings, "AWS_WAF_SCOPE", "REGIONAL") # CLOUDFRONT or REGIONAL

    if not aws_access_key or not waf_ipset_id:
        log.debug("soar.aws_waf_skipped", reason="AWS credentials or IPSet ID not configured")
        return "SIMULATED_ACTIVE"

    try:
        import boto3
        waf = boto3.client(
            "wafv2",
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=getattr(settings, "AWS_REGION", "us-east-1"),
        )

        # Get current IPSet
        ipset = waf.get_ip_set(
            Name=waf_ipset_name,
            Scope=waf_scope,
            Id=waf_ipset_id,
        )
        lock_token = ipset["LockToken"]
        addresses = ipset["IPSet"]["Addresses"]

        # Append new IP (needs CIDR suffix, e.g. /32)
        cidr_ip = ip_address if "/" in ip_address else f"{ip_address}/32"
        if cidr_ip not in addresses:
            addresses.append(cidr_ip)
            
            # Update IPSet
            waf.update_ip_set(
                Name=waf_ipset_name,
                Scope=waf_scope,
                Id=waf_ipset_id,
                Addresses=addresses,
                LockToken=lock_token,
            )
            log.info("soar.aws_waf_rule_added", ip=cidr_ip, ipset=waf_ipset_name)
            return "ACTIVE"
        
        return "ALREADY_BLOCKED"

    except Exception as e:
        log.error("soar.aws_waf_failed", error=str(e))
        return "FAILED"


async def _inject_cloudflare_rule(ip_address: str) -> str:
    """Inject Cloudflare IP access rule to block malicious IP."""
    cf_token = getattr(settings, "CLOUDFLARE_API_TOKEN", "")
    cf_zone_id = getattr(settings, "CLOUDFLARE_ZONE_ID", "")

    if not cf_token or not cf_zone_id:
        log.debug("soar.cloudflare_skipped", reason="Cloudflare API settings not configured")
        return "SIMULATED_ACTIVE"

    try:
        url = f"https://api.cloudflare.com/client/v4/zones/{cf_zone_id}/firewall/access_rules/rules"
        headers = {
            "Authorization": f"Bearer {cf_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "mode": "block",
            "configuration": {
                "target": "ip",
                "value": ip_address,
            },
            "notes": "Automated block by DeepGuard SOAR Gateway",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                log.info("soar.cloudflare_rule_added", ip=ip_address)
                return "ACTIVE"
            else:
                log.warning("soar.cloudflare_rule_non_success", status=res.status_code)
                return "FAILED"

    except Exception as e:
        log.error("soar.cloudflare_failed", error=str(e))
        return "FAILED"
