"""
app/api/v1/oauth.py — Full OAuth2 PKCE SSO Endpoints

Implements proper OAuth2 Authorization Code + PKCE flow for:
  - Google (OpenID Connect)
  - GitHub
  - Microsoft 365 (Azure AD)

Each provider flow:
  1. GET /auth/oauth/{provider} — Returns authorization URL with PKCE challenge
  2. POST /auth/oauth/{provider}/callback — Exchanges code for tokens, auto-creates user
"""
from __future__ import annotations

import hashlib
import base64
import secrets
import uuid
from datetime import datetime, timezone

import structlog
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.db.models.user import User
from app.db.models.refresh_token import RefreshToken
from app.db.session import get_db

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth/oauth", tags=["OAuth SSO"])


# ─── PKCE Helpers ──────────────────────────────────────────────────────────────

def _generate_pkce() -> tuple:
    """Generate PKCE code_verifier and code_challenge."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge


# ─── Request / Response Schemas ───────────────────────────────────────────────

class OAuthAuthorizationResponse(BaseModel):
    provider: str
    auth_url: str
    code_verifier: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    state: str
    redirect_uri: str = "http://localhost:5173/auth/callback"


class OAuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str
    user: dict


# ─── Provider Configurations ──────────────────────────────────────────────────

PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": "openid email profile",
        "client_id_key": "GOOGLE_CLIENT_ID",
        "client_secret_key": "GOOGLE_CLIENT_SECRET",
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "email_url": "https://api.github.com/user/emails",
        "scopes": "user:email",
        "client_id_key": "GITHUB_CLIENT_ID",
        "client_secret_key": "GITHUB_CLIENT_SECRET",
    },
    "microsoft": {
        "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scopes": "openid email profile User.Read",
        "client_id_key": "MICROSOFT_CLIENT_ID",
        "client_secret_key": "MICROSOFT_CLIENT_SECRET",
    },
}


# ─── GET /auth/oauth/{provider} — Authorization URL ──────────────────────────

@router.get("/{provider}", response_model=OAuthAuthorizationResponse)
async def get_authorization_url(provider: str):
    """Generate OAuth2 PKCE authorization URL for the specified provider."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    config = PROVIDERS[provider]
    client_id = getattr(settings, config["client_id_key"], "")

    if not client_id:
        raise HTTPException(
            status_code=503,
            detail=f"OAuth provider '{provider}' is not configured. Set {config['client_id_key']} in .env."
        )

    code_verifier, code_challenge = _generate_pkce()
    state = secrets.token_urlsafe(32)
    redirect_uri = f"{settings.WEBAUTHN_ORIGIN}/auth/callback"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": config["scopes"],
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    if provider == "google":
        params["access_type"] = "offline"
        params["prompt"] = "consent"

    query = "&".join(f"{k}={v}" for k, v in params.items())
    auth_url = f"{config['authorize_url']}?{query}"

    log.info("oauth.authorization_url_generated", provider=provider)

    return OAuthAuthorizationResponse(
        provider=provider,
        auth_url=auth_url,
        code_verifier=code_verifier,
        state=state,
    )


# ─── POST /auth/oauth/{provider}/callback — Token Exchange ───────────────────

@router.post("/{provider}/callback", response_model=OAuthTokenResponse)
async def oauth_callback(
    provider: str,
    body: OAuthCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Exchange authorization code for tokens and create/login user."""
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    config = PROVIDERS[provider]
    client_id = getattr(settings, config["client_id_key"], "")
    client_secret = getattr(settings, config["client_secret_key"], "")

    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail=f"OAuth provider '{provider}' is not configured.")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Exchange code for access token
            token_data = {
                "client_id": client_id,
                "client_secret": client_secret,
                "code": body.code,
                "redirect_uri": body.redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": body.code_verifier,
            }

            headers = {"Accept": "application/json"}
            token_resp = await client.post(config["token_url"], data=token_data, headers=headers)

            if token_resp.status_code != 200:
                log.warning("oauth.token_exchange_failed", provider=provider, status=token_resp.status_code)
                raise HTTPException(status_code=400, detail="Failed to exchange authorization code.")

            token_json = token_resp.json()
            provider_access_token = token_json.get("access_token")

            if not provider_access_token:
                raise HTTPException(status_code=400, detail="No access token in provider response.")

            # Step 2: Fetch user info
            auth_headers = {"Authorization": f"Bearer {provider_access_token}"}
            userinfo_resp = await client.get(config["userinfo_url"], headers=auth_headers)

            if userinfo_resp.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch user info from provider.")

            userinfo = userinfo_resp.json()

            # Extract email (provider-specific)
            user_email = userinfo.get("email")

            if not user_email and provider == "github":
                # GitHub may not include email in profile; fetch from emails endpoint
                email_resp = await client.get(config["email_url"], headers=auth_headers)
                if email_resp.status_code == 200:
                    emails = email_resp.json()
                    primary = next((e for e in emails if e.get("primary")), None)
                    if primary:
                        user_email = primary.get("email")

            if not user_email:
                raise HTTPException(status_code=400, detail="Could not retrieve email from OAuth provider.")

            # Step 3: Find or create user
            result = await db.execute(select(User).where(User.email == user_email))
            user = result.scalar_one_or_none()

            if not user:
                user = User(
                    id=uuid.uuid4(),
                    email=user_email,
                    hashed_password=hash_password(secrets.token_hex(32)),
                    role="USER",
                    is_active=True,
                    oauth_provider=provider,
                    tier="FREE",
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
                log.info("oauth.user_auto_created", provider=provider, email=user_email)
            else:
                if user.deleted_at is not None:
                    raise HTTPException(status_code=403, detail="Account has been deleted.")
                if not user.is_active:
                    raise HTTPException(status_code=403, detail="Account is deactivated.")

            # Update last login
            user.last_login = datetime.now(timezone.utc)
            if not user.oauth_provider:
                user.oauth_provider = provider
            await db.commit()

            # Step 4: Generate JWT tokens
            access_token = create_access_token(subject=str(user.id))
            raw_refresh, refresh_hash, refresh_expires = create_refresh_token()

            refresh_record = RefreshToken(
                user_id=user.id,
                token_hash=refresh_hash,
                expires_at=refresh_expires,
            )
            db.add(refresh_record)
            await db.commit()

            log.info("oauth.login_success", provider=provider, email=user_email)

            return OAuthTokenResponse(
                access_token=access_token,
                refresh_token=raw_refresh,
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                role=user.role,
                user={
                    "id": str(user.id),
                    "email": user.email,
                    "role": user.role,
                    "oauth_provider": user.oauth_provider,
                },
            )

    except HTTPException:
        raise
    except Exception as e:
        log.error("oauth.callback_failed", provider=provider, error=str(e))
        raise HTTPException(status_code=400, detail=f"OAuth authentication failed: {str(e)}")
