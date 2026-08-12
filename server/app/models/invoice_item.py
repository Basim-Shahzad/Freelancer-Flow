from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Invoice import Invoice
    from app.models.TimeEntry import TimeEntry
    from app.models.Milestone import Milestone


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    invoice: Mapped["Invoice"] = relationship(back_populates="items")

    # Optional traceability back to the billing source. Hourly-billed lines
    # point at the TimeEntry they were generated from; fixed-price/milestone
    # lines point at the Milestone instead. Both nullable since an item can
    # also be a manually added ad-hoc charge with neither.
    time_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("time_entries.id", ondelete="SET NULL"), nullable=True
    )
    time_entry: Mapped[Optional["TimeEntry"]] = relationship()

    milestone_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True
    )
    milestone: Mapped[Optional["Milestone"]] = relationship()

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), nullable=False, default=1
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(precision=13, scale=2), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=13, scale=2), nullable=False
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
