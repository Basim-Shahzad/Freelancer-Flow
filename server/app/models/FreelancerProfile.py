from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, String, Numeric, Text
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
    type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Default currency (ISO-4217); snapshotted onto each invoice.
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="SAR")

    # Business identity printed on invoices.
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    business_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vat_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    default_payment_terms_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    # Percentage, e.g. 15.00 for 15% VAT.
    default_tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), nullable=False, default=0
    )

    # Last issued invoice sequence number; incremented under a row lock so
    # numbers stay gap-free and unique per freelancer.
    invoice_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Self-reported cash position, used for runway calculations.
    bank_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=13, scale=2), nullable=True
    )
    bank_balance_updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

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
