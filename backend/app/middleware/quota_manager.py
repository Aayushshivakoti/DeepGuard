"""
app/middleware/quota_manager.py — Redis-Backed Tiered Quota & Rate Limiting

Production quota management with:
  - Redis-backed per-user daily scan counters
  - Tier-based limits (FREE, PRO, ENTERPRISE)
  - In-memory fallback when Redis is unavailable
  - Rate limit headers (X-RateLimit-Remaining, X-RateLimit-Limit)
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# Tier quota definitions
TIER_QUOTAS = {
    "FREE":       {"daily_scans": 50,    "max_mb": 10,   "concurrent_api": 2},
    "PRO":        {"daily_scans": 1000,  "max_mb": 100,  "concurrent_api": 10},
    "ENTERPRISE": {"daily_scans": 50000, "max_mb": 1000, "concurrent_api": 50},
}

# In-memory fallback when Redis is unavailable
_memory_counters: Dict[str, Dict[str, Any]] = {}


def _get_redis_client():
    """Create Redis client if available."""
    try:
        import redis
        client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=2)
        client.ping()
        return client
    except Exception:
        return None


def _redis_key(user_id: str) -> str:
    """Generate Redis key for daily quota tracking."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"deepguard:quota:{user_id}:{today}"


async def check_user_quota(
    user_id: str,
    user_tier: str = "FREE",
    user_role: str = "USER",
) -> Dict[str, Any]:
    """
    Check and enforce user quota limits.

    Returns dict with allowed, tier, scans_today, daily_limit, remaining.
    """
    # Admin override
    if user_role.upper() == "ADMIN":
        effective_tier = "ENTERPRISE"
    else:
        effective_tier = user_tier.upper() if user_tier.upper() in TIER_QUOTAS else "FREE"

    quota = TIER_QUOTAS[effective_tier]
    scans_today = await _get_scan_count(user_id)
    allowed = scans_today < quota["daily_scans"]
    remaining = max(0, quota["daily_scans"] - scans_today)

    if not allowed:
        log.warning("quota.exceeded", user_id=user_id, tier=effective_tier,
                    scans_today=scans_today, limit=quota["daily_scans"])

    return {
        "allowed": allowed,
        "tier": effective_tier,
        "scans_today": scans_today,
        "daily_limit": quota["daily_scans"],
        "remaining": remaining,
        "max_upload_mb": quota["max_mb"],
        "concurrent_limit": quota["concurrent_api"],
    }


async def increment_scan_count(user_id: str) -> int:
    """Increment user's daily scan counter. Returns new count."""
    redis_client = _get_redis_client()
    key = _redis_key(user_id)

    if redis_client:
        try:
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, 86400)  # 24h TTL
            results = pipe.execute()
            new_count = results[0]
            log.debug("quota.redis_incremented", user_id=user_id, count=new_count)
            return new_count
        except Exception as e:
            log.warning("quota.redis_incr_failed", error=str(e))

    # In-memory fallback
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if user_id not in _memory_counters or _memory_counters[user_id].get("date") != today:
        _memory_counters[user_id] = {"date": today, "count": 0}

    _memory_counters[user_id]["count"] += 1
    return _memory_counters[user_id]["count"]


async def _get_scan_count(user_id: str) -> int:
    """Get user's current daily scan count."""
    redis_client = _get_redis_client()
    key = _redis_key(user_id)

    if redis_client:
        try:
            count = redis_client.get(key)
            return int(count) if count else 0
        except Exception as e:
            log.debug("quota.redis_get_failed", error=str(e))

    # In-memory fallback
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = _memory_counters.get(user_id, {})
    if entry.get("date") == today:
        return entry.get("count", 0)
    return 0


def get_quota_headers(quota_result: Dict[str, Any]) -> Dict[str, str]:
    """Generate HTTP headers for rate limit information."""
    return {
        "X-RateLimit-Limit": str(quota_result["daily_limit"]),
        "X-RateLimit-Remaining": str(quota_result["remaining"]),
        "X-RateLimit-Reset": str(
            int(datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            ).timestamp()) + 86400
        ),
        "X-RateLimit-Tier": quota_result["tier"],
    }


# Legacy compatibility function
def check_user_quota_sync(user_role: str = "USER", current_scans_today: int = 5) -> Dict[str, Any]:
    """Synchronous quota check (backward compatible)."""
    tier = "ENTERPRISE" if user_role.upper() == "ADMIN" else "FREE"
    quota = TIER_QUOTAS[tier]
    allowed = current_scans_today < quota["daily_scans"]

    return {
        "allowed": allowed,
        "tier": tier,
        "scans_today": current_scans_today,
        "daily_limit": quota["daily_scans"],
        "remaining": max(0, quota["daily_scans"] - current_scans_today),
    }
