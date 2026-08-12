from __future__ import annotations
import uuid
import enum
from typing import TYPE_CHECKING, List, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, String, Numeric, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.User import User
    from app.models.ClientProfile import ClientProfile
    from app.models.Project import Project, ProjectStatus
    from app.models.FreelancerProfile import FreelancerProfile
    from app.models.invoice_item import InvoiceItem


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELEED = "cancelled"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, index=True
    )
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False
    )

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
        back_populates="invoice", cascade="all, delete-orphan"
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(precision=13, scale=2), nullable=False
    )
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(precision=4, scale=2), nullable=False, default=0
    )
    discount_rate: Mapped[Decimal] = mapped_column(
            Numeric(precision=4, scale=2), nullable=False, default=0
        )
    total: Mapped[Decimal] = mapped_column(
        Numeric(precision=13, scale=2), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    payment_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            nullable=False,
            default=lambda: datetime.now(timezone.utc),
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
