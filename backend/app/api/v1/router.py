"""
app/api/v1/router.py — V1 API Router Aggregator
Mounts all sub-routers under the /api/v1 prefix.
"""
from fastapi import APIRouter

from app.api.v1.scan import router as scan_router
from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.user import router as user_router
from app.api.v1.monitors import router as monitors_router
from app.api.v1.team import router as team_router
from app.api.v1.webauthn import router as webauthn_router
from app.api.v1.oauth import router as oauth_router
from app.api.v1.websockets import router as websockets_router

api_v1_router = APIRouter()

api_v1_router.include_router(scan_router)
api_v1_router.include_router(admin_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(user_router)
api_v1_router.include_router(monitors_router)
api_v1_router.include_router(team_router)
api_v1_router.include_router(webauthn_router)
api_v1_router.include_router(oauth_router)
api_v1_router.include_router(websockets_router)
