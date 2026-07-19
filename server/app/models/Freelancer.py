from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, List
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.User import User

if TYPE_CHECKING:
    from app.models.Project import Project
    from app.models.Client import Client


class Freelancer(Base):
    __tablename__ = "freelancers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=13, scale=2), nullable=True
    )
    type: Mapped[str | None] = mapped_column(String(255), nullable=True)

    email_verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # relationships
    # A freelancer's clients. Cascade removed: deleting a Freelancer should
    # not silently wipe out Client/Project history. Handle client
    # reassignment or soft-delete explicitly at the service layer instead.
    clients: Mapped[List["Client"]] = relationship(back_populates="freelancer")
    user: Mapped["User"] = relationship(back_populates="freelancer")

    # foreign keys
    # One-to-one with User: unique=True enforces at most one Freelancer row
    # per user at the database level, matching the ORM-level uselist=False.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
