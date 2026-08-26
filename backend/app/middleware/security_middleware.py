"""
app/middleware/security_middleware.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production Security Middleware Stack

Provides:
  1. CSRF Token Validation — double-submit cookie pattern for state-changing requests
  2. SSRF Protection — blocks URL scan inputs targeting private/internal IPs
  3. Request Body Size Enforcement — prevents oversized uploads
  4. Security Headers — HSTS, X-Content-Type-Options, X-Frame-Options
"""
from __future__ import annotations

import hashlib
import ipaddress
import secrets
import socket
import os
from urllib.parse import urlparse

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

log = structlog.get_logger(__name__)

# Methods that modify state and require CSRF protection
STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths exempt from CSRF (API auth endpoints use JWT, not cookies)
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/google",
    "/api/v1/auth/webauthn/verify",
    "/api/v1/scan/file",
    "/api/v1/scan/url",
    "/docs",
    "/openapi.json",
    "/health",
    "/readiness",
}

# Private IP ranges that must never be accessed via URL scan
PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
]

# Cloud metadata endpoints
BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "169.254.169.254",                         # AWS/GCP/Azure metadata
    "metadata.internal",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects standard security response headers."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"

        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using double-submit cookie pattern.
    Validates X-CSRF-Token header matches csrf_token cookie on state-changing requests.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip exempt paths
        if path in CSRF_EXEMPT_PATHS or path.startswith("/docs") or path.startswith("/redoc"):
            response = await call_next(request)
            return response

        # Validate CSRF for state-changing methods
        if request.method in STATE_CHANGING_METHODS:
            cookie_token = request.cookies.get("csrf_token")
            header_token = request.headers.get("X-CSRF-Token")

            if not cookie_token or not header_token:
                log.warning("csrf.missing_token", path=path, method=request.method)
                return Response(
                    content='{"detail": "CSRF token required for state-changing requests."}',
                    status_code=403,
                    media_type="application/json",
                )

            if not secrets.compare_digest(cookie_token, header_token):
                log.warning("csrf.token_mismatch", path=path)
                return Response(
                    content='{"detail": "CSRF token validation failed."}',
                    status_code=403,
                    media_type="application/json",
                )

        response = await call_next(request)

        # Set CSRF cookie if not present
        if "csrf_token" not in request.cookies:
            csrf_token = secrets.token_hex(32)
            response.set_cookie(
                "csrf_token",
                csrf_token,
                httponly=False,  # Must be readable by JS
                samesite="strict",
                secure=True,
                max_age=3600,
            )

        return response


def validate_url_ssrf(url: str) -> str:
    """
    Validate a URL is safe to fetch (not targeting private IPs or cloud metadata).
    Returns the resolved IP address string if safe, raises ValueError if SSRF attempt detected.
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname

        if not hostname:
            raise ValueError("URL has no hostname.")

        # Block known dangerous hostnames
        if hostname.lower() in BLOCKED_HOSTNAMES:
            raise ValueError(f"Access to {hostname} is blocked (cloud metadata endpoint).")

        # Block file:// and other dangerous schemes
        if parsed.scheme not in ("http", "https"):
            raise ValueError(f"URL scheme '{parsed.scheme}' is not allowed. Use http or https.")

        # Resolve hostname to IP and check against private ranges
        resolved_ip = None
        try:
            resolved_ips = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
            for family, _, _, _, addr in resolved_ips:
                ip_str = addr[0]
                ip_obj = ipaddress.ip_address(ip_str)
                for network in PRIVATE_NETWORKS:
                    if ip_obj in network:
                        if settings.USE_MOCK_MODELS:
                            continue
                        raise ValueError(
                            f"URL resolves to private IP {ip_str} ({network}). "
                            "Scanning internal network resources is blocked."
                        )
                if not resolved_ip:
                    resolved_ip = ip_str
        except socket.gaierror:
            # DNS resolution failed — allow (may be a valid external domain)
            log.debug("ssrf.dns_resolution_failed", hostname=hostname)

        return resolved_ip or hostname

    except ValueError:
        raise
    except Exception as e:
        log.warning("ssrf.validation_error", url=url, error=str(e))
        raise ValueError(f"URL validation failed: {str(e)}")


async def safe_http_request(url: str, method: str = "GET", **kwargs) -> httpx.Response:
    """
    Executes a secure HTTP request to a user-provided URL by resolving the domain once,
    verifying it is not a private IP, and making the request directly to the IP with a Host header.
    Neutralizes DNS Rebinding and SSRF attacks.
    """
    resolved_ip = validate_url_ssrf(url)
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    
    # If the hostname resolved to a valid IP, rewrite the URL to direct IP
    if resolved_ip and resolved_ip != hostname:
        port = f":{parsed.port}" if parsed.port else ""
        rewritten_url = f"{parsed.scheme}://{resolved_ip}{port}{parsed.path}"
        if parsed.query:
            rewritten_url += f"?{parsed.query}"
            
        headers = kwargs.get("headers", {})
        headers["Host"] = hostname
        kwargs["headers"] = headers
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            return await client.request(method, rewritten_url, **kwargs)
    else:
        async with httpx.AsyncClient(timeout=10.0) as client:
            return await client.request(method, url, **kwargs)


# ─── File Magic Byte Validation ─────────────────────────────────────────────

MAGIC_BYTES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # RIFF....WEBP
    "image/gif": [b"GIF87a", b"GIF89a"],
    "audio/wav": [b"RIFF"],   # RIFF....WAVE
    "audio/mpeg": [b"\xff\xfb", b"\xff\xf3", b"\xff\xf2", b"ID3"],
    "audio/mp4": [b"\x00\x00\x00", b"ftyp"],
    "video/mp4": [b"\x00\x00\x00", b"ftyp"],
    "video/quicktime": [b"\x00\x00\x00", b"ftyp"],
    "application/pdf": [b"%PDF"],
}


def validate_file_magic_bytes(buffer: bytes, declared_mime: str) -> bool:
    """
    Verify file magic bytes match the declared MIME type.

    Prevents polyglot file attacks where a file masquerades as a different type.

    Returns True if valid, raises ValueError on mismatch.
    """
    if len(buffer) < 8:
        raise ValueError("File is too small to validate (minimum 8 bytes).")

    expected_magics = MAGIC_BYTES.get(declared_mime.lower())

    if expected_magics is None:
        # Unknown MIME type — allow but log
        log.debug("magic_bytes.unknown_mime", mime=declared_mime)
        return True

    header = buffer[:16]

    for magic in expected_magics:
        if header[:len(magic)] == magic or magic in header:
            return True

    raise ValueError(
        f"File magic bytes do not match declared MIME type '{declared_mime}'. "
        f"Header bytes: {header[:8].hex()}. Possible polyglot file attack."
    )


# ─── Password Complexity Validation ─────────────────────────────────────────

def validate_password_complexity(password: str) -> bool:
    """
    Validate password meets complexity requirements.

    Requirements:
      - Minimum 8 characters
      - At least 1 uppercase letter
      - At least 1 lowercase letter
      - At least 1 digit
      - At least 1 special character

    Returns True if valid, raises ValueError with specific failure reason.
    """
    min_length = getattr(settings, "PASSWORD_MIN_LENGTH", 8)
    require_complexity = getattr(settings, "PASSWORD_REQUIRE_COMPLEXITY", True)

    if len(password) < min_length:
        raise ValueError(f"Password must be at least {min_length} characters long.")

    if not require_complexity:
        return True

    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase letter.")

    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase letter.")

    if not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one digit.")

    special_chars = set("!@#$%^&*()_+-=[]{}|;':\",./<>?`~")
    if not any(c in special_chars for c in password):
        raise ValueError("Password must contain at least one special character (!@#$%^&*...).")

    return True
