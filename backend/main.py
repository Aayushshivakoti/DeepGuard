"""
main.py — FastAPI Application Entry Point
Deepfake & Phishing Media Verification Gateway
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.core.rate_limit import RateLimitMiddleware
from app.db.session import engine
from app.db.base import Base  
from app.db.models.user import User  # noqa: F401
from app.db.models.scan_result import ScanResult  # noqa: F401
from app.db.models.audit_log import AuditLog  # noqa: F401
from app.db.models.scan_record import ScanRecord  # noqa: F401
from app.db.models.scheduled_monitor import ScheduledMonitor  # noqa: F401
from app.db.models.refresh_token import RefreshToken  # noqa: F401
from app.db.models.webauthn_credential import WebAuthnCredential  # noqa: F401
from app.middleware.security_middleware import SecurityHeadersMiddleware, CSRFProtectionMiddleware

log = structlog.get_logger(__name__)


# ─── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """Application startup / shutdown lifecycle handler."""
    configure_logging()
    log.info("deepguard.startup", env=settings.APP_ENV, debug=settings.DEBUG)

    # Database tables should be initialized via Alembic migrations or init_db.py, not here.
    if settings.DEBUG:
        log.info("deepguard.db.tables_check_skipped")
        
    # Seed default Admin and Standard User credentials if they do not exist
    from app.db.init_db import seed_users
    await seed_users()

    yield  # ← server is running

    log.info("deepguard.shutdown")
    await engine.dispose()


# ─── App Factory ───────────────────────────────────────────────────────────────

def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Production-grade AI-powered API gateway for detecting deepfake media "
            "(images, audio, video) and phishing URLs / documents."
        ),
        version="3.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # ── Middleware ──────────────────────────────────────────────────────────────
    
    # 1. Security Headers
    app.add_middleware(SecurityHeadersMiddleware)

    # 2. CSRF Protection
    app.add_middleware(CSRFProtectionMiddleware)

    # 3. CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 4. Rate Limiting (Redis-backed counter/quota rate limiting is also in quota_manager.py)
    app.add_middleware(RateLimitMiddleware, redis_url=settings.REDIS_URL)

    if not settings.DEBUG:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

    # ── Request Timing & Telemetry Middleware ────────────────────────────────────
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_sec = time.perf_counter() - start
        elapsed_ms = round(elapsed_sec * 1000, 2)
        response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
        
        # Instrument telemetry
        from app.core.telemetry import instrument_request
        instrument_request(request.method, request.url.path, response.status_code, elapsed_sec)
        
        return response

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(api_v1_router, prefix="/api/v1")

    # ── Health Check ───────────────────────────────────────────────────────────
    @app.get("/health", tags=["System"], summary="Health check")
    async def health() -> dict:
        return {"status": "ok", "service": settings.APP_NAME, "version": "3.1.0"}

    # ── Prometheus Metrics ──────────────────────────────────────────────────────
    @app.get("/metrics", tags=["System"], summary="Prometheus Metrics")
    async def metrics():
        from app.core.telemetry import get_prometheus_metrics
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(get_prometheus_metrics())

    # ── Readiness Probe ────────────────────────────────────────────────────────
    @app.get("/readiness", tags=["System"], summary="Readiness probe")
    async def readiness() -> dict:
        # Check DB connection readiness
        try:
            from sqlalchemy import text
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as e:
            log.error("readiness.db_failed", error=str(e))
            db_status = "disconnected"

        status_code = 200 if db_status == "connected" else 503
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "ready" if db_status == "connected" else "not_ready",
                "components": {
                    "database": db_status,
                }
            }
        )

    # ── Global Exception Handler ───────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        log.error("deepguard.unhandled_exception", path=str(request.url), error=str(exc))
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Please try again later."},
        )

    return app


app = create_application()


# ─── Dev Entry Point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True,
    )
