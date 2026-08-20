"""
app/services/siem_logger.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIEM & Audit Log Integration Service

Formats security audit logs into standard Syslog / CEF (Common Event Format)
structures with HMAC-SHA256 integrity verification. Exports to Splunk,
Elasticsearch, Datadog, or SIEM HTTP Collectors.
"""
import hmac
import hashlib
import time
import structlog
from typing import Dict, Any, Optional

log = structlog.get_logger(__name__)

def format_cef_event(
    device_vendor: str = "DeepGuard",
    device_product: str = "ForensicGateway",
    device_version: str = "v3.1",
    signature_id: str = "SCAN_VERDICT",
    name: str = "Media Authenticity Inspection",
    severity: str = "5",
    extension_data: Optional[Dict[str, Any]] = None,
    secret_key: str = "DeepGuard-SIEM-HMAC"
) -> Dict[str, Any]:
    """
    Format standard CEF syslog payload with HMAC-SHA256 signature.
    CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|Extension
    """
    ext_str = " ".join([f"{k}={v}" for k, v in (extension_data or {}).items()])
    cef_string = f"CEF:0|{device_vendor}|{device_product}|{device_version}|{signature_id}|{name}|{severity}|{ext_str}"
    
    # Calculate HMAC signature over CEF string
    hmac_sig = hmac.new(
        secret_key.encode("utf-8"),
        cef_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    syslog_payload = {
        "cef": cef_string,
        "hmac_sha256": hmac_sig,
        "timestamp": int(time.time()),
        "destination": "SIEM_COLLECTOR"
    }

    log.info("siem.event_formatted", signature=signature_id, hmac=hmac_sig[:12])
    return syslog_payload
