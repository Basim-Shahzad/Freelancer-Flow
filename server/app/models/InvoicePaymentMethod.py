from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.sensitive import EncryptedText
from app.db.database import Base
from app.models.PaymentMethodConfig import PaymentMethodType

if TYPE_CHECKING:
    from app.models.Invoice import Invoice


class InvoicePaymentMethod(Base):
    """How the client can pay this invoice: a self-contained snapshot of a
    ``PaymentMethodConfig``, so later edits or deletes of the config never
    rewrite an issued invoice. Paylancer only displays it; it never moves money.
    """

    __tablename__ = "invoice_payment_methods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    invoice: Mapped["Invoice"] = relationship(back_populates="payment_methods")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    type: Mapped[PaymentMethodType] = mapped_column(
        Enum(PaymentMethodType), nullable=False
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Serialized JSON copy of the config's details, encrypted at rest.
    details: Mapped[str] = mapped_column(EncryptedText, nullable=False)
    source_method_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("payment_method_configs.id", ondelete="SET NULL"), nullable=True
    )
