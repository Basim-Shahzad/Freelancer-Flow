from __future__ import annotations
import uuid
import enum
from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.ClientProfile import ClientProfile
    from app.models.Project import Project
    from app.models.FreelancerProfile import FreelancerProfile
    from app.models.InvoiceItem import InvoiceItem
    from app.models.Payment import Payment
    from app.models.InvoicePaymentMethod import InvoicePaymentMethod


class InvoiceStatus(str, enum.Enum):
    """Persisted lifecycle state.

    "Overdue" is intentionally *not* stored: it is derived from ``due_date``
    and the outstanding balance (see ``Invoice.is_overdue``), so it can never
    go stale or conflict with ``PARTIALLY_PAID``.
    """

    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    # Unpaid balance given up as uncollectable; payments already recorded stay.
    WRITTEN_OFF = "WRITTEN_OFF"
    CANCELLED = "CANCELLED"


class Invoice(Base):
    __tablename__ = "invoices"

    __table_args__ = (
        UniqueConstraint(
            "freelancer_id", "invoice_number", name="uq_invoice_freelancer_number"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )
    # ISO-4217 snapshot taken at creation.
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    freelancer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("freelancers.id", ondelete="RESTRICT"), nullable=False
    )
    freelancer: Mapped["FreelancerProfile"] = relationship(back_populates="invoices")
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    client: Mapped["ClientProfile"] = relationship(back_populates="invoices")
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False
    )
    project: Mapped["Project"] = relationship(back_populates="invoices")
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", lazy="selectin"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Payment.paid_at",
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False
    )
    # Percentage (e.g. 10.00 == 10%).
    taxes: Mapped[list["InvoiceTax"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="InvoiceTax.sort_order",
    )
    payment_methods: Mapped[list["InvoicePaymentMethod"]] = relationship(
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="InvoicePaymentMethod.sort_order",
    )
    # Shown on the invoice when no/zero tax applies (reverse charge, exempt...).
    tax_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    discount_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=5, scale=2), nullable=False, default=0
    )
    # Amount snapshots so aggregates (tax collected) never depend on re-deriving.
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False, default=0
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False, default=0
    )
    # Withholding deducted from what the client pays (not tax collected).
    withholding_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False, default=0
    )
    total: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Shown to the client; Paylancer never receives the money itself.
    payment_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Lifecycle timestamps. NULL until the event happens.
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    viewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # When the invoice became fully paid (NULL while unpaid / part-paid).
    payment_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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

    # -- derived values (require `payments` to be loaded; it is selectin) ----

    @property
    def issuer(self) -> dict:
        """Business identity printed on the invoice (falls back to the user's
        name). Requires ``freelancer`` and ``freelancer.user`` to be loaded."""
        f = self.freelancer
        return {
            "name": f.business_name or (f.user.full_name if f.user else None),
            "business_name": f.business_name,
            "address": f.business_address,
            "tax_registration_number": f.tax_registration_number,
            "tax_label": f.tax_label,
            "logo_url": f.logo_url,
        }

    @property
    def amount_paid(self) -> Decimal:
        return sum((p.amount for p in self.payments), Decimal("0.00"))

    @property
    def balance_due(self) -> Decimal:
        if self.status in (InvoiceStatus.CANCELLED, InvoiceStatus.WRITTEN_OFF):
            return Decimal("0.00")
        return max(self.total - self.amount_paid, Decimal("0.00"))

    @property
    def is_overdue(self) -> bool:
        if self.status not in (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID):
            return False
        due = self.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        return due < datetime.now(timezone.utc)


class InvoiceTax(Base):
    """A tax applied to an invoice: a snapshot, so later config changes never
    rewrite issued invoices."""

    __tablename__ = "invoice_taxes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice: Mapped["Invoice"] = relationship(back_populates="taxes")
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(precision=7, scale=4), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=18, scale=4), nullable=False)
    is_inclusive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_compound: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_withholding: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
