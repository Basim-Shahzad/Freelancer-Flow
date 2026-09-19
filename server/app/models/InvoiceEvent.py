from __future__ import annotations
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class InvoiceEventType(str, enum.Enum):
    SENT = "SENT"
    VIEWED = "VIEWED"
    REMINDED = "REMINDED"
    PAYMENT_RECORDED = "PAYMENT_RECORDED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class InvoiceEvent(Base):
    """Append-only log of what happened to an invoice ("opened", "chased", ...)."""

    __tablename__ = "invoice_events"
    __table_args__ = (Index("ix_invoice_events_invoice_id", "invoice_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[InvoiceEventType] = mapped_column(
        Enum(InvoiceEventType), nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    # Short human-readable context, e.g. "Reminder #2" or a payment reference.
    detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
