"""
app/db/models/webauthn_credential.py — WebAuthn/FIDO2 Credential ORM Model
Stores registered passkey credentials per user for passwordless auth.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, LargeBinary, String, Text, Uuid, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    credential_id: Mapped[str] = mapped_column(
        Text, nullable=False, unique=True, index=True,
        comment="Base64URL-encoded credential ID from authenticator",
    )
    public_key: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Base64URL-encoded COSE public key",
    )
    sign_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Counter to detect cloned authenticators",
    )
    device_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="User-provided label for this passkey",
    )
    aaguid: Mapped[str | None] = mapped_column(
        String(36), nullable=True,
        comment="Authenticator Attestation GUID",
    )
    transports: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
        comment="Comma-separated transport hints: usb, ble, nfc, internal",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    def __repr__(self) -> str:
        return f"<WebAuthnCredential id={self.id} user_id={self.user_id} device={self.device_name}>"
