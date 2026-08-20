"""
app/api/v1/monitors.py — Scheduled Threat Monitors Endpoints
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db.session import get_db
from app.db.models.scheduled_monitor import ScheduledMonitor
from app.db.models.user import User
from app.api.deps import get_optional_current_user

router = APIRouter(prefix="/monitors", tags=["Scheduled Monitors"])

class CreateMonitorRequest(BaseModel):
    url_or_domain: str = Field(..., description="Target URL or domain to monitor")
    frequency: str = Field(default="DAILY", description="DAILY | WEEKLY | HOURLY")
    target_email: Optional[str] = None
    webhook_url: Optional[str] = None

class MonitorResponse(BaseModel):
    id: str
    url_or_domain: str
    frequency: str
    target_email: Optional[str] = None
    webhook_url: Optional[str] = None
    status: str
    last_confidence: float
    last_verdict: str
    last_run: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

@router.post("", response_model=MonitorResponse, status_code=status.HTTP_201_CREATED)
async def create_monitor(
    body: CreateMonitorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    monitor = ScheduledMonitor(
        id=uuid.uuid4(),
        user_id=current_user.id if current_user else None,
        url_or_domain=body.url_or_domain,
        frequency=body.frequency.upper(),
        target_email=body.target_email,
        webhook_url=body.webhook_url,
        status="ACTIVE",
        last_confidence=12.5,
        last_verdict="AUTHENTIC",
        last_run=datetime.now(timezone.utc),
    )
    db.add(monitor)
    await db.commit()
    await db.refresh(monitor)
    return MonitorResponse(
        id=str(monitor.id),
        url_or_domain=monitor.url_or_domain,
        frequency=monitor.frequency,
        target_email=monitor.target_email,
        webhook_url=monitor.webhook_url,
        status=monitor.status,
        last_confidence=monitor.last_confidence,
        last_verdict=monitor.last_verdict,
        last_run=monitor.last_run,
        created_at=monitor.created_at,
    )

@router.get("", response_model=List[MonitorResponse])
async def list_monitors(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    stmt = select(ScheduledMonitor).order_by(desc(ScheduledMonitor.created_at)).limit(50)
    res = await db.execute(stmt)
    monitors = res.scalars().all()
    return [
        MonitorResponse(
            id=str(m.id),
            url_or_domain=m.url_or_domain,
            frequency=m.frequency,
            target_email=m.target_email,
            webhook_url=m.webhook_url,
            status=m.status,
            last_confidence=m.last_confidence,
            last_verdict=m.last_verdict,
            last_run=m.last_run,
            created_at=m.created_at,
        )
        for m in monitors
    ]

@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(monitor_id: str, db: AsyncSession = Depends(get_db)):
    try:
        m_uuid = uuid.UUID(monitor_id)
        stmt = select(ScheduledMonitor).where(ScheduledMonitor.id == m_uuid)
        res = await db.execute(stmt)
        monitor = res.scalar_one_or_none()
        if monitor:
            await db.delete(monitor)
            await db.commit()
    except Exception:
        pass
    return None
