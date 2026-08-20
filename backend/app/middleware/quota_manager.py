"""
app/middleware/quota_manager.py — Tiered Quota & Rate Limiting Middleware
"""
import structlog
from typing import Dict, Any

log = structlog.get_logger(__name__)

TIER_QUOTAS = {
    "FREE": {"daily_scans": 50, "max_mb": 10, "concurrent_api": 2},
    "PRO": {"daily_scans": 1000, "max_mb": 100, "concurrent_api": 10},
    "ENTERPRISE": {"daily_scans": 50000, "max_mb": 1000, "concurrent_api": 50},
}

def check_user_quota(user_role: str = "USER", current_scans_today: int = 5) -> Dict[str, Any]:
    tier = "PRO" if user_role.upper() == "ADMIN" else "FREE"
    quota = TIER_QUOTAS[tier]
    allowed = current_scans_today < quota["daily_scans"]
    
    return {
        "allowed": allowed,
        "tier": tier,
        "scans_today": current_scans_today,
        "daily_limit": quota["daily_scans"],
        "remaining": max(0, quota["daily_scans"] - current_scans_today)
    }
