"""
alembic/env.py — Alembic Migration Environment
Configured for async SQLAlchemy with asyncpg.
"""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import Base and all models for auto-detection
from app.db.base import Base  # noqa: F401
import app.db.models.user           # noqa: F401
import app.db.models.scan_result    # noqa: F401
import app.db.models.scan_record    # noqa: F401
import app.db.models.audit_log      # noqa: F401
import app.db.models.team           # noqa: F401
import app.db.models.scheduled_monitor  # noqa: F401
import app.db.models.refresh_token       # noqa: F401
import app.db.models.webauthn_credential # noqa: F401

config = context.config
fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations with async engine."""
    # Use sync URL for Alembic (replace asyncpg with psycopg2)
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = cfg.get("sqlalchemy.url", "").replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
