from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, Optional, List
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

if TYPE_CHECKING:
    from app.models.User import User
    from app.models.Project import Project
    from app.models.FreelancerProfile import FreelancerProfile
    from app.models.Invoice import Invoice


class ClientProfile(Base):
    __tablename__ = "clients"

    __table_args__ = (
        # Same freelancer can't add the same client email twice.
        UniqueConstraint("freelancer_id", "email", name="uq_client_freelancer_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    invoices: Mapped[List["Invoice"]] = relationship(
        back_populates="client"
    )

    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Whether this client is subject to approval flow (freelancer opts in,
    # per-client or per-project depending on how you wire the checks).
    requires_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Relationships
    projects: Mapped[list["Project"]] = relationship(
        back_populates="client", cascade="all, delete-orphan", lazy="select"
    )
    freelancer: Mapped["FreelancerProfile"] = relationship(back_populates="clients")

    # One-to-one, optional: set only if this guest client converts into a
    # real logged-in account. NULL forever for clients who never register.
    user: Mapped[Optional["User"]] = relationship(back_populates="client_account")

    # Foreign keys
    freelancer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("freelancers.id", ondelete="CASCADE"), nullable=False
    )

    # Nullable + unique: no account yet -> NULL; converted -> points at
    # exactly one User, and that User can't back a second ClientProfile.
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
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
