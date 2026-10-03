from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Numeric, Text
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
        Numeric(precision=18, scale=4), nullable=True
    )
    type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Default currency (ISO-4217); snapshotted onto each invoice. NULL until the
    # freelancer chooses one: the app assumes no currency or country.
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Informational (ISO-3166 alpha-2); no logic branches on it.
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    # IANA zone used for "today" (runway, filing periods). Storage stays UTC.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    # Business identity printed on invoices.
    business_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    business_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Free-text registration id (VAT/GST/EIN/...); never format-validated.
    tax_registration_number: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )
    # What this jurisdiction calls its tax on documents ("VAT", "GST", ...).
    tax_label: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    default_payment_terms_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    # Taxes applied to new invoices unless overridden. List of objects:
    # {name, rate, is_inclusive, is_compound, is_withholding}. Empty = untaxed.
    default_taxes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # "accrual": tax is due when invoiced; "cash": when the invoice is paid.
    tax_basis: Mapped[str] = mapped_column(String(10), nullable=False, default="accrual")
    # Template for invoice numbers; tokens: {seq}, {year}. e.g. "INV-{seq:04d}".
    invoice_number_format: Mapped[str] = mapped_column(
        String(100), nullable=False, default="INV-{seq:04d}"
    )

    # Last issued invoice sequence number; incremented under a row lock so
    # numbers stay gap-free and unique per freelancer.
    invoice_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Self-reported cash position, used for runway calculations.
    bank_balance: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=18, scale=4), nullable=True
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
