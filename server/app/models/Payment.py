from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Invoice import Invoice


class PaymentMethod(str, enum.Enum):
    """How the client paid. Pakistan-first priority methods come first."""

    # International receipts for Pakistan residents.
    PAYONEER = "PAYONEER"
    ESFCA_WIRE = "ESFCA_WIRE"
    ELEVATE_PAY = "ELEVATE_PAY"
    WISE_TO_IBAN = "WISE_TO_IBAN"
    # Domestic PKR methods.
    BANK_TRANSFER = "BANK_TRANSFER"
    RAAST = "RAAST"
    JAZZCASH = "JAZZCASH"
    EASYPAISA = "EASYPAISA"
    # Other methods.
    CARD = "CARD"
    CASH = "CASH"
    CHEQUE = "CHEQUE"
    PAYPAL = "PAYPAL"
    OTHER = "OTHER"


class Payment(Base):
    """A single receipt of money against an invoice (supports part-payments)."""

    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_invoice_id", "invoice_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    invoice: Mapped["Invoice"] = relationship(back_populates="payments")

    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False
    )
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod), nullable=False, default=PaymentMethod.BANK_TRANSFER
    )
    reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
