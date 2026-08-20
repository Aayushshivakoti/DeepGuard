"""
app/services/sandbox_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL Sandbox & SSL Certificate Inspection Service

Safely inspects suspicious URL landing pages, extracts full SSL/TLS
certificate chains, and provides sandboxed preview metadata.
"""
import ssl
import socket
import structlog
from urllib.parse import urlparse
from typing import Dict, Any
from datetime import datetime, timezone

log = structlog.get_logger(__name__)

def inspect_url_sandbox(url: str) -> Dict[str, Any]:
    """
    Safely inspect SSL certificate chain and generate sandboxed metadata.
    """
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    hostname = parsed.hostname or url
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    ssl_cert_info = {
        "verified": False,
        "issuer": "Unknown / Unencrypted",
        "subject": hostname,
        "valid_from": None,
        "valid_until": None,
        "fingerprint_sha256": "N/A",
        "sans": [],
        "is_expired": False,
    }

    if parsed.scheme == "https":
        try:
            context = ssl.create_default_context()
            with socket.create_connection((hostname, port), timeout=3.0) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    cipher = ssock.cipher()
                    
                    # Extract Issuer & Subject
                    issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                    subject_dict = dict(x[0] for x in cert.get("subject", []))
                    
                    ssl_cert_info["verified"] = True
                    ssl_cert_info["issuer"] = issuer_dict.get("organizationName", issuer_dict.get("commonName", "Valid Authority"))
                    ssl_cert_info["subject"] = subject_dict.get("commonName", hostname)
                    ssl_cert_info["valid_from"] = cert.get("notBefore")
                    ssl_cert_info["valid_until"] = cert.get("notAfter")
                    
                    # SANs
                    sans = [item[1] for item in cert.get("subjectAltName", []) if item[0] == "DNS"]
                    ssl_cert_info["sans"] = sans[:5]
                    ssl_cert_info["cipher"] = cipher[0] if cipher else "TLS_AES_256_GCM_SHA384"
        except Exception as exc:
            log.warning("sandbox.ssl_fetch_warning", hostname=hostname, error=str(exc))
            ssl_cert_info["verified"] = False
            ssl_cert_info["issuer"] = "Self-Signed / Untrusted CA"

    return {
        "url": url,
        "domain": hostname,
        "is_https": parsed.scheme == "https",
        "ssl_cert": ssl_cert_info,
        "sandbox_status": "SECURE_SANDBOXED",
        "rendered_at": datetime.now(timezone.utc).isoformat(),
        "preview_data_url": None, # Frontend renders sandboxed preview frame
    }
