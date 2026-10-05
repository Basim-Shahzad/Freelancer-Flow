from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.sensitive import EncryptedText
from app.db.database import Base


class PaymentMethodType(str, enum.Enum):
    PAYONEER = "PAYONEER"
    ESFCA_WIRE = "ESFCA_WIRE"
    ELEVATE_PAY = "ELEVATE_PAY"
    WISE_TO_IBAN = "WISE_TO_IBAN"
    PKR_BANK_TRANSFER = "PKR_BANK_TRANSFER"
    RAAST = "RAAST"
    JAZZCASH = "JAZZCASH"
    EASYPAISA = "EASYPAISA"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class PaymentMethodConfig(Base):
    """How a freelancer wants to be paid; snapshotted onto invoices (Step 5).

    Paylancer only *displays* these details. It never moves money.
    """

    __tablename__ = "payment_method_configs"
    __table_args__ = (
        Index("ix_payment_methods_freelancer_order", "freelancer_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    freelancer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("freelancers.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[PaymentMethodType] = mapped_column(
        Enum(PaymentMethodType), nullable=False
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Serialized JSON (IBANs, wallet numbers...), encrypted at rest.
    details: Mapped[str] = mapped_column(EncryptedText, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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
