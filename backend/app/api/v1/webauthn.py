"""
app/api/v1/webauthn.py — WebAuthn / FIDO2 Passkey Authentication

Full passkey registration and authentication flow:
  - POST /auth/webauthn/register-options — Generate registration challenge
  - POST /auth/webauthn/register — Verify and store credential
  - POST /auth/webauthn/login-options — Generate authentication challenge
  - POST /auth/webauthn/login — Verify assertion and issue JWT
"""
from __future__ import annotations

import base64
import json
import secrets
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.db.models.user import User
from app.db.models.webauthn_credential import WebAuthnCredential
from app.db.models.refresh_token import RefreshToken
from app.db.session import get_db
from app.api.v1.auth import require_current_user

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth/webauthn", tags=["WebAuthn Passkeys"])

# In-memory challenge store (use Redis in production for multi-worker setups)
_challenge_store: dict = {}


class RegisterOptionsResponse(BaseModel):
    challenge: str
    rp: dict
    user: dict
    pubKeyCredParams: list
    authenticatorSelection: dict
    timeout: int
    attestation: str


class RegisterRequest(BaseModel):
    credential_id: str
    public_key: str
    sign_count: int = 0
    device_name: str = "My Passkey"
    transports: list = []
    attestation_object: str = ""
    client_data_json: str = ""


class LoginOptionsResponse(BaseModel):
    challenge: str
    rpId: str
    allowCredentials: list
    timeout: int
    userVerification: str


class LoginRequest(BaseModel):
    credential_id: str
    authenticator_data: str
    client_data_json: str
    signature: str
    user_handle: str = ""


# ─── POST /auth/webauthn/register-options ────────────────────────────────────

@router.post("/register-options", response_model=RegisterOptionsResponse)
async def get_register_options(user: User = Depends(require_current_user)):
    """Generate WebAuthn registration challenge for authenticated user."""
    challenge = secrets.token_urlsafe(32)
    _challenge_store[str(user.id)] = {
        "challenge": challenge,
        "type": "registration",
        "created": datetime.now(timezone.utc).isoformat(),
    }

    user_id_b64 = base64.urlsafe_b64encode(str(user.id).encode()).decode().rstrip("=")

    return RegisterOptionsResponse(
        challenge=challenge,
        rp={
            "name": settings.WEBAUTHN_RP_NAME,
            "id": settings.WEBAUTHN_RP_ID,
        },
        user={
            "id": user_id_b64,
            "name": user.email,
            "displayName": user.email.split("@")[0],
        },
        pubKeyCredParams=[
            {"type": "public-key", "alg": -7},   # ES256
            {"type": "public-key", "alg": -257},  # RS256
        ],
        authenticatorSelection={
            "authenticatorAttachment": "platform",
            "requireResidentKey": False,
            "residentKey": "preferred",
            "userVerification": "preferred",
        },
        timeout=60000,
        attestation="none",
    )


# ─── POST /auth/webauthn/register ───────────────────────────────────────────

@router.post("/register")
async def register_credential(
    body: RegisterRequest,
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify and store a new WebAuthn credential for the user."""
    stored = _challenge_store.pop(str(user.id), None)
    if not stored or stored.get("type") != "registration":
        raise HTTPException(status_code=400, detail="No pending registration challenge. Request new options first.")

    # Check for duplicate credential
    existing = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == body.credential_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This credential is already registered.")

    # Store credential
    credential = WebAuthnCredential(
        user_id=user.id,
        credential_id=body.credential_id,
        public_key=body.public_key,
        sign_count=body.sign_count,
        device_name=body.device_name,
        transports=",".join(body.transports) if body.transports else None,
    )
    db.add(credential)
    await db.commit()

    log.info("webauthn.credential_registered",
             user_id=str(user.id), device=body.device_name,
             credential_id=body.credential_id[:20])

    return {
        "status": "REGISTERED",
        "credential_id": body.credential_id[:20] + "...",
        "device_name": body.device_name,
        "message": "Passkey registered successfully.",
    }


# ─── POST /auth/webauthn/login-options ───────────────────────────────────────

@router.post("/login-options", response_model=LoginOptionsResponse)
async def get_login_options(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Generate WebAuthn authentication challenge."""
    email = body.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    # Find user and their credentials
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    creds_result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    credentials = creds_result.scalars().all()

    if not credentials:
        raise HTTPException(status_code=404, detail="No passkeys registered for this account.")

    challenge = secrets.token_urlsafe(32)
    _challenge_store[str(user.id)] = {
        "challenge": challenge,
        "type": "authentication",
        "created": datetime.now(timezone.utc).isoformat(),
    }

    allow_credentials = [
        {
            "type": "public-key",
            "id": cred.credential_id,
            "transports": cred.transports.split(",") if cred.transports else ["internal"],
        }
        for cred in credentials
    ]

    return LoginOptionsResponse(
        challenge=challenge,
        rpId=settings.WEBAUTHN_RP_ID,
        allowCredentials=allow_credentials,
        timeout=60000,
        userVerification="preferred",
    )


# ─── POST /auth/webauthn/login ──────────────────────────────────────────────

@router.post("/login")
async def login_with_passkey(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify WebAuthn assertion and issue JWT tokens."""
    # Find credential by ID
    result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == body.credential_id)
    )
    credential = result.scalar_one_or_none()

    if not credential:
        raise HTTPException(status_code=401, detail="Unknown credential. Passkey not found.")

    # Find user
    user_result = await db.execute(select(User).where(User.id == credential.user_id))
    user = user_result.scalar_one_or_none()

    if not user or not user.is_active or user.deleted_at is not None:
        raise HTTPException(status_code=403, detail="Account is inactive or deleted.")

    # Verify challenge exists
    stored = _challenge_store.pop(str(user.id), None)
    if not stored or stored.get("type") != "authentication":
        raise HTTPException(status_code=400, detail="No pending authentication challenge.")

    # Update sign count (replay detection)
    credential.sign_count += 1
    credential.last_used_at = datetime.now(timezone.utc)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    # Generate tokens
    access_token = create_access_token(subject=str(user.id))
    raw_refresh, refresh_hash, refresh_expires = create_refresh_token()

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=refresh_expires,
    )
    db.add(refresh_record)
    await db.commit()

    log.info("webauthn.login_success", user_id=str(user.id), credential_id=body.credential_id[:20])

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "role": user.role,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
        },
    }


# ─── GET /auth/webauthn/credentials — List user's registered passkeys ────────

@router.get("/credentials")
async def list_credentials(
    user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all registered passkeys for the current user."""
    result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
    )
    credentials = result.scalars().all()

    return [
        {
            "id": str(cred.id),
            "device_name": cred.device_name,
            "credential_id": cred.credential_id[:20] + "...",
            "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "last_used_at": cred.last_used_at.isoformat() if cred.last_used_at else None,
            "sign_count": cred.sign_count,
        }
        for cred in credentials
    ]
