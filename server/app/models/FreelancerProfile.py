from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.User import User
    from app.models.ClientProfile import ClientProfile
    from app.models.Invoice import Invoice


class FreelancerProfile(Base):
    __tablename__ = "freelancers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    hourly_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=13, scale=2), nullable=True
    )
    type: Mapped[Optional[String]] = mapped_column(String(255), nullable=True)

    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    # One freelancer -> many client records they manage (guest or converted).
    clients: Mapped[List["ClientProfile"]] = relationship(
        back_populates="freelancer",
        cascade="all, delete-orphan",
        lazy="select",
    )
    invoices: Mapped[List["Invoice"]] = relationship(
        back_populates="freelancer"
    )
    user: Mapped["User"] = relationship(back_populates="freelancer")

    # Foreign keys
    # Unique -> enforces the one-to-one: a user has at most one FreelancerProfile.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
