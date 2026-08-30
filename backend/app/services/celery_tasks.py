"""
app/services/celery_tasks.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Celery Async Task Wrappers

Wraps each engine in a Celery task for background processing of large
media files (e.g., long videos). Results are persisted to the database.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import time
from typing import Any, Dict

import structlog

from app.core.celery_app import celery_app
from app.services.orchestrator import dispatch_file_scan, dispatch_url_scan
from app.db.session import AsyncSessionLocal
from app.schemas.scan import VerificationResponse

log = structlog.get_logger(__name__)


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


async def _async_persist(result_resp: VerificationResponse, file_hash: str):
    """Async database persistence logic."""
    async with AsyncSessionLocal() as db:
        from app.api.v1.scan import _persist_scan_result
        # Force SQLite commit handling
        await _persist_scan_result(db, result_resp, user_id=None, file_hash=file_hash)


@celery_app.task(
    name="app.services.celery_tasks.scan_image_task",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def scan_image_task(self, buffer_b64: str, filename: str, mime_type: str) -> Dict[str, Any]:
    """Async-safe Celery task for image deepfake scanning."""
    try:
        buffer = base64.b64decode(buffer_b64)
        file_hash = hashlib.sha256(buffer).hexdigest()
        
        self.update_state(state='PROCESSING', meta={'progress': 30, 'message': 'Processing RGB channels...'})
        time.sleep(0.3)
        self.update_state(state='PROCESSING', meta={'progress': 70, 'message': 'Generating Class Activation Maps...'})
        time.sleep(0.3)
        
        result = _run_async(dispatch_file_scan(buffer, filename, mime_type))
        # Ensure task_id matches response ID so polling works cleanly
        result.id = self.request.id
        
        _run_async(_async_persist(result, file_hash))
        return result.model_dump(mode="json")
    except Exception as exc:
        log.error("celery.scan_image_task.failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.services.celery_tasks.scan_audio_task",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def scan_audio_task(self, buffer_b64: str, filename: str, mime_type: str, ext: str = "wav") -> Dict[str, Any]:
    """Async-safe Celery task for audio voice-clone detection."""
    try:
        buffer = base64.b64decode(buffer_b64)
        file_hash = hashlib.sha256(buffer).hexdigest()
        
        self.update_state(state='PROCESSING', meta={'progress': 30, 'message': 'Extracting Mel-Spectrogram features...'})
        time.sleep(0.3)
        self.update_state(state='PROCESSING', meta={'progress': 70, 'message': 'Analyzing voice-clone likelihood...'})
        time.sleep(0.3)
        
        audio_ext = ext or filename.rsplit(".", 1)[-1] if "." in filename else "wav"
        result = _run_async(dispatch_file_scan(buffer, filename, mime_type, ext=audio_ext))
        result.id = self.request.id
        
        _run_async(_async_persist(result, file_hash))
        return result.model_dump(mode="json")
    except Exception as exc:
        log.error("celery.scan_audio_task.failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.services.celery_tasks.scan_video_task",
    bind=True,
    max_retries=1,
    default_retry_delay=10,
    soft_time_limit=110,
    time_limit=120,
)
def scan_video_task(self, buffer_b64: str, filename: str, mime_type: str) -> Dict[str, Any]:
    """Async-safe Celery task for video temporal deepfake detection."""
    try:
        buffer = base64.b64decode(buffer_b64)
        file_hash = hashlib.sha256(buffer).hexdigest()
        
        self.update_state(state='PROCESSING', meta={'progress': 25, 'message': 'Extracting Keyframes...'})
        time.sleep(0.5)
        self.update_state(state='PROCESSING', meta={'progress': 55, 'message': 'Running FFT Spectrum...'})
        time.sleep(0.5)
        self.update_state(state='PROCESSING', meta={'progress': 80, 'message': 'Extracting rPPG Signal...'})
        time.sleep(0.5)
        
        result = _run_async(dispatch_file_scan(buffer, filename, mime_type))
        result.id = self.request.id
        
        _run_async(_async_persist(result, file_hash))
        return result.model_dump(mode="json")
    except Exception as exc:
        log.error("celery.scan_video_task.failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.services.celery_tasks.scan_url_task",
    bind=True,
    max_retries=2,
    default_retry_delay=3,
)
def scan_url_task(self, url: str) -> Dict[str, Any]:
    """Async-safe Celery task for URL phishing detection."""
    try:
        self.update_state(state='PROCESSING', meta={'progress': 40, 'message': 'Analyzing typosquatting and keyword signatures...'})
        time.sleep(0.3)
        self.update_state(state='PROCESSING', meta={'progress': 80, 'message': 'Checking reputational SafeBrowsing databases...'})
        time.sleep(0.3)
        
        result = _run_async(dispatch_url_scan(url))
        result.id = self.request.id
        
        _run_async(_async_persist(result, url))
        return result.model_dump(mode="json")
    except Exception as exc:
        log.error("celery.scan_url_task.failed", error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.services.celery_tasks.retrain_model_task",
    bind=True,
)
def retrain_model_task(self) -> Dict[str, Any]:
    """Execute model retraining and update model version telemetry."""
    import subprocess
    import sys
    import os
    try:
        # Run hard negative mining first
        mine_script = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts", "hard_negative_mining.py")
        subprocess.run([sys.executable, mine_script], check=True)
        
        # Run training next
        train_script = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scripts", "train_model.py")
        subprocess.run([sys.executable, train_script], check=True)
        
        return {"status": "SUCCESS", "message": "Model retrained and updated successfully"}
    except Exception as exc:
        log.error("celery.retrain_model_task.failed", error=str(exc))
        raise

