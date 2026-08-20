"""
app/api/v1/user.py — User Workspace Endpoints
"""
from __future__ import annotations

from typing import List
import structlog
from fastapi import APIRouter, Depends, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.models.scan_record import ScanRecord
from app.db.session import get_db
from app.schemas.scan import ScanHistoryItem

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/user", tags=["User"])


@router.get(
    "/scans",
    response_model=List[ScanHistoryItem],
    summary="Get scan history for current user",
    status_code=status.HTTP_200_OK,
)
async def get_user_scans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ScanHistoryItem]:
    """
    Fetch all scan records created by the currently authenticated user.
    """
    try:
        stmt = (
            select(ScanRecord)
            .where(ScanRecord.user_id == current_user.id)
            .order_by(desc(ScanRecord.created_at))
        )
        result = await db.execute(stmt)
        records = result.scalars().all()

        return [
            ScanHistoryItem(
                id=str(r.id),
                filename=r.filename if r.media_type != "url" else None,
                url=r.filename if r.media_type == "url" else None,
                media_type=r.media_type,  # type: ignore
                verdict=r.verdict if r.verdict in ("AUTHENTIC", "SUSPICIOUS") else "DEEPFAKE_DETECTED",  # type: ignore
                confidence=r.confidence_score,
                timestamp=r.created_at,
            )
            for r in records
        ]
    except Exception as exc:
        log.error("user.scans.error", error=str(exc))
        return []
