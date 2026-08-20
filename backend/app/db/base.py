"""
app/db/base.py — SQLAlchemy Declarative Base
Import all models here so Alembic and create_all() can discover them.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# Base is imported by models, do not import models here to prevent circular imports.
