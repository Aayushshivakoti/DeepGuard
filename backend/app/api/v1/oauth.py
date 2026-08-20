"""
app/api/v1/oauth.py — OAuth2 / Single Sign-On (SSO) Endpoints
"""
from fastapi import APIRouter

router = APIRouter(prefix="/auth/oauth", tags=["OAuth SSO"])

@router.get("/google")
async def oauth_google():
    return {"provider": "Google", "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=demo"}

@router.get("/github")
async def oauth_github():
    return {"provider": "GitHub", "auth_url": "https://github.com/login/oauth/authorize?client_id=demo"}

@router.get("/microsoft")
async def oauth_microsoft():
    return {"provider": "Microsoft 365", "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=demo"}
