"""
app/core/security.py — JWT Token Management, Password Hashing, & Security Utilities

Provides:
  - bcrypt password hashing with configurable rounds
  - JWT access token creation and decoding
  - JWT refresh token creation and verification (SHA-256 hashed)
  - HMAC signature verification
  - PDF payload sanitization
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Tuple

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ─── Password Hashing ──────────────────────────────────────────────────────────


def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of the plain-text password."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored hash."""
    try:
        password_bytes = plain_password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ─── JWT Access Tokens ─────────────────────────────────────────────────────────

def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def get_subject_from_token(token: str) -> str | None:
    """Extract the subject (user id) from a JWT token, returns None if invalid."""
    try:
        payload = decode_access_token(token)
        return payload.get("sub")
    except JWTError:
        return None


# ─── JWT Refresh Tokens ────────────────────────────────────────────────────────

def create_refresh_token() -> Tuple[str, str, datetime]:
    """
    Generate a new refresh token.

    Returns:
        (raw_token, token_hash, expires_at) — store the hash in DB,
        return raw_token to client.
    """
    raw_token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    """Hash a raw refresh token for DB lookup."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ─── HMAC Signature Verification ─────────────────────────────────────────────

def verify_hmac_signature(payload: bytes, signature_hex: str, secret_key: str) -> bool:
    """
    Verify if the payload matches the HMAC-SHA256 signature generated with the secret key.
    Uses constant-time comparison to prevent timing attacks.
    """
    try:
        expected = hmac.new(
            secret_key.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature_hex)
    except Exception:
        return False


def generate_hmac_signature(payload: bytes, secret_key: str) -> str:
    """Generate HMAC-SHA256 signature for a payload."""
    return hmac.new(
        secret_key.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()


# ─── In-Memory File Sanitizer ────────────────────────────────────────────────

def sanitize_pdf_payload(buffer: bytes) -> bool:
    """
    Scan in-memory PDF payload for structure anomalies and embedded exploit scripts.
    Checks for common exploit markers like /JavaScript, /JS, /OpenAction, /Launch.
    """
    if not buffer.startswith(b"%PDF"):
        raise ValueError("Invalid PDF header structure.")
        
    exploit_markers = [
        b"/JS",
        b"/JavaScript",
        b"/AA",
        b"/OpenAction",
        b"/Launch",
        b"/EmbeddedFiles"
    ]
    
    for marker in exploit_markers:
        if marker in buffer:
            raise ValueError(f"Malicious payload indicator detected in PDF: {marker.decode('utf-8')}")
            
    return True
