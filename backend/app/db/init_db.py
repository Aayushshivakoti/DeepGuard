from __future__ import annotations

import asyncio
import structlog
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base
from app.db.models.user import User
from app.core.security import hash_password

log = structlog.get_logger(__name__)

async def seed_users() -> None:
    """Seed default administrator and user accounts if they do not exist."""
    async with AsyncSessionLocal() as db:
        try:
            # 1. Seed Admin Account
            res_admin = await db.execute(select(User).where(User.email == "admin@example.com"))
            admin = res_admin.scalar_one_or_none()
            if not admin:
                admin = User(
                    email="admin@example.com",
                    hashed_password=hash_password("AdminPass123!"),
                    role="ADMIN",
                    is_active=True
                )
                db.add(admin)
                await db.flush()
                log.info("db.seeded_admin", email="admin@example.com")

            # 2. Seed Standard User Account
            res_user = await db.execute(select(User).where(User.email == "user@example.com"))
            user = res_user.scalar_one_or_none()
            if not user:
                user = User(
                    email="user@example.com",
                    hashed_password=hash_password("UserPass123!"),
                    role="USER",
                    is_active=True
                )
                db.add(user)
                await db.flush()
                log.info("db.seeded_user", email="user@example.com")

            await db.commit()
        except Exception as e:
            await db.rollback()
            log.error("db.seeding_failed", error=str(e))

async def init_db() -> None:
    """Create all database tables and seed default users."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_users()

if __name__ == "__main__":
    asyncio.run(init_db())

