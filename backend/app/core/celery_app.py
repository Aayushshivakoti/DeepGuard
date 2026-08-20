"""
app/core/celery_app.py — Celery Worker Configuration
Broker: Redis | Backend: Redis | Task routing by media type
"""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "deepguard",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.services.celery_tasks"],
)

celery_app.conf.update(
    # ── Serialisation ─────────────────────────────────────────────────────────
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # ── Timezone ──────────────────────────────────────────────────────────────
    timezone="UTC",
    enable_utc=True,
    # ── Task Behaviour ────────────────────────────────────────────────────────
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    # ── Result Expiry ─────────────────────────────────────────────────────────
    result_expires=3600,  # 1 hour
    # ── Timeouts ─────────────────────────────────────────────────────────────
    task_soft_time_limit=120,   # 2 min soft limit
    task_time_limit=180,        # 3 min hard kill
    # ── Routing ───────────────────────────────────────────────────────────────
    task_routes={
        "app.services.celery_tasks.scan_image_task": {"queue": "image_queue"},
        "app.services.celery_tasks.scan_audio_task": {"queue": "audio_queue"},
        "app.services.celery_tasks.scan_video_task": {"queue": "video_queue"},
        "app.services.celery_tasks.scan_url_task": {"queue": "url_queue"},
    },
    task_default_queue="default",
)
