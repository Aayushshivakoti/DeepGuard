"""
app/api/v1/websockets.py — Real-time WebSockets Manager & Endpoints

Provides real-time streaming updates for:
  - Active scan progress and verdicts
  - Live analyst threat alerts & system logs
"""
from __future__ import annotations

from fastapi import HTTPException, Query, status
from jose import jwt, JWTError
from app.core.config import settings
from typing import Dict, List
import asyncio
def verify_jwt_token(token: str):
        """Validate JWT token and return payload or raise HTTPException."""
        if not token:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing JWT token")
        try:
            # Expect token format "Bearer <jwt>"
            if token.lower().startswith("bearer "):
                token = token[7:]
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            return payload
        except JWTError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid JWT token")


import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from celery.result import AsyncResult
from app.core.celery_app import celery_app

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/ws", tags=["Real-time WebSockets"])


# ─── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections for broadcasts and client routing."""

    def __init__(self):
        self.active_scans: Dict[str, List[WebSocket]] = {}  # job_id -> list of connections
        self.admin_feed: List[WebSocket] = []              # admin broadcast channel

    async def connect_scan(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_scans.setdefault(job_id, []).append(websocket)
        log.info("ws.client_connected_to_scan", job_id=job_id)

    def disconnect_scan(self, job_id: str, websocket: WebSocket):
        if job_id in self.active_scans:
            if websocket in self.active_scans[job_id]:
                self.active_scans[job_id].remove(websocket)
            if not self.active_scans[job_id]:
                del self.active_scans[job_id]
        log.info("ws.client_disconnected_from_scan", job_id=job_id)

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_feed.append(websocket)
        log.info("ws.admin_client_connected", count=len(self.admin_feed))

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_feed:
            self.admin_feed.remove(websocket)
        log.info("ws.admin_client_disconnected", count=len(self.admin_feed))

    async def send_scan_update(self, job_id: str, message: dict):
        """Send status update to all clients watching a specific scan job."""
        if job_id in self.active_scans:
            dead_connections = []
            for ws in self.active_scans[job_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(ws)

            for dead in dead_connections:
                self.disconnect_scan(job_id, dead)

    async def broadcast_admin_alert(self, alert_payload: dict):
        """Broadcast live threat alert to all connected admin panels."""
        dead_connections = []
        for ws in self.admin_feed:
            try:
                await ws.send_json(alert_payload)
            except Exception:
                dead_connections.append(ws)

        for dead in dead_connections:
            self.disconnect_admin(dead)


# Global WebSocket manager singleton
ws_manager = ConnectionManager()


# ─── WebSocket Endpoints ───────────────────────────────────────────────────────

@router.websocket("/scans/{job_id}")
async def websocket_scan_status(websocket: WebSocket, job_id: str, token: str = Query(...)):
    """
    WebSocket endpoint for streaming updates on a specific background scan job.
    Bridges Celery Redis results to WebSocket connections.
    """
    # Verify JWT before accepting connection
    try:
        verify_jwt_token(token)
    except HTTPException:
        await websocket.close(code=1008)
        return
    await ws_manager.connect_scan(job_id, websocket)
    try:
        last_state = None
        last_progress = None

        while True:
            res = AsyncResult(job_id, app=celery_app)
            state = res.state
            
            progress = 10
            message = "Job is queued..."
            result = None

            if state == "SUCCESS":
                progress = 100
                message = "Scan completed successfully."
                result = res.result
            elif state == "PROCESSING" or state == "STARTED":
                info = res.info or {}
                progress = info.get("progress", 50)
                message = info.get("message", "Running forensic checks...")
            elif state == "FAILURE":
                progress = 0
                message = str(res.result or "Task failed.")

            if state != last_state or progress != last_progress:
                payload = {
                    "status": "SUCCESS" if state == "SUCCESS" else ("FAILED" if state == "FAILURE" else "PROCESSING"),
                    "progress": progress,
                    "message": message,
                    "result": result
                }
                await websocket.send_json(payload)
                
                # Also broadcast to alert feed if critical threat detected
                if state == "SUCCESS" and result and result.get("verdict") in ("DEEPFAKE_DETECTED", "PHISHING_DETECTED"):
                    await ws_manager.broadcast_admin_alert({
                        "severity": "critical",
                        "message": f"Threat detected: {result.get('filename') or result.get('url')}",
                        "media_type": result.get("media_type"),
                        "confidence": result.get("confidence")
                    })

                last_state = state
                last_progress = progress

            if state in ("SUCCESS", "FAILURE"):
                break

            await asyncio.sleep(1.0)
            
    except WebSocketDisconnect:
        ws_manager.disconnect_scan(job_id, websocket)
    except Exception as e:
        log.warning("ws.scan_connection_error", error=str(e), job_id=job_id)
        ws_manager.disconnect_scan(job_id, websocket)


@router.websocket("/alerts")
async def websocket_admin_alerts(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time threat feed updates (admin view).
    """
    # Verify JWT before accepting connection
    try:
        verify_jwt_token(token)
    except HTTPException:
        await websocket.close(code=1008)
        return
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)
    except Exception as e:
        log.warning("ws.admin_connection_error", error=str(e))
        ws_manager.disconnect_admin(websocket)
