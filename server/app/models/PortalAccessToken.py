from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from datetime import datetime, timezone
import enum

from sqlalchemy import DateTime, ForeignKey, String, Text, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

class ScopeType(str, enum.Enum):
    PROJECT = "project"
    MILESTONE = "milestone"

class PortalAccessToken(Base):
    __tablename__ = "portal_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    jti: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    scope_type: Mapped[ScopeType] = mapped_column(
        Enum(ScopeType), nullable=False
    )
    scope: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=True,
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
