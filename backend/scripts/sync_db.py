# backend/scripts/sync_db.py
"""
Utility script to create all missing database tables for DeepGuard.
Imports all models to register them with the SQLAlchemy Declarative Base.
"""
from __future__ import annotations

import asyncio
import os
import sys

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.db.base import Base

# Import all models to register them
from app.db.models.audit_log import AuditLog
from app.db.models.refresh_token import RefreshToken
from app.db.models.retrain_queue import RetrainQueue
from app.db.models.scan_record import ScanRecord
from app.db.models.scan_result import ScanResult
from app.db.models.scheduled_monitor import ScheduledMonitor
from app.db.models.team import Team
from app.db.models.user import User
from app.db.models.webauthn_credential import WebAuthnCredential

async def sync():
    from sqlalchemy.ext.asyncio import create_async_engine
    print(f"Connecting to database: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Creating all tables in database...")
        await conn.run_sync(Base.metadata.create_all)
        print("All tables synchronized successfully.")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(sync())
