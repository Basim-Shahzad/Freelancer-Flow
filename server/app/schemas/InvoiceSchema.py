from __future__ import annotations
import enum
import uuid
from decimal import Decimal
from typing import Optional

from pydantic import Field, computed_field, model_validator

from app.models.Invoice import InvoiceStatus
from app.models.InvoiceEvent import InvoiceEventType

from .Base import Base
from .PaymentSchema import PaymentResponse
from .types import CurrencyCode, Money, Percent, UTCDateTime


class InvoiceDisplayStatus(str, enum.Enum):
    """Status as shown to users: the stored status plus derived ``OVERDUE``."""

    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"


# ── Requests ──────────────────────────────────────────────────────────────────


class InvoiceItemCreate(Base):
    """A manually entered line item."""

    description: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=2, default=Decimal("1"))
    unit_price: Money


class InvoiceCreate(Base):
    """POST /invoices

    Lines can come from any mix of manual ``items``, un-invoiced billable
    ``timeEntryIds`` (billed at each entry's rate snapshot) and
    ``milestoneIds`` (billed at the milestone amount). At least one line is
    required.
    """

    project_id: uuid.UUID
    issue_date: Optional[UTCDateTime] = Field(default=None, description="Defaults to now.")
    due_date: Optional[UTCDateTime] = Field(
        default=None,
        description="Defaults to issue date + client payment terms (or the "
        "freelancer's default terms).",
    )
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to project, client, then freelancer currency."
    )
    tax_rate: Optional[Percent] = Field(
        default=None, description="Percent. Defaults to the freelancer's default VAT rate."
    )
    discount_rate: Percent = Decimal("0")
    notes: Optional[str] = Field(default=None, max_length=5000)
    items: list[InvoiceItemCreate] = Field(default_factory=list, max_length=200)
    time_entry_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    milestone_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)

    @model_validator(mode="after")
    def _validate(self) -> "InvoiceCreate":
        if not (self.items or self.time_entry_ids or self.milestone_ids):
            raise ValueError(
                "An invoice needs at least one item, time entry or milestone"
            )
        if (
            self.issue_date is not None
            and self.due_date is not None
            and self.due_date < self.issue_date
        ):
            raise ValueError("due_date cannot be before issue_date")
        return self


class InvoiceUpdate(Base):
    """PATCH /invoices/{id}: header fields of a DRAFT invoice only."""

    issue_date: Optional[UTCDateTime] = None
    due_date: Optional[UTCDateTime] = None
    tax_rate: Optional[Percent] = None
    discount_rate: Optional[Percent] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


# ── Responses ─────────────────────────────────────────────────────────────────


class InvoiceItemResponse(Base):
    id: uuid.UUID
    description: str
    quantity: Decimal
    unit_price: Money
    amount: Money
    time_entry_id: Optional[uuid.UUID] = None
    milestone_id: Optional[uuid.UUID] = None


class InvoiceParty(Base):
    id: uuid.UUID
    name: str


class InvoiceIssuer(Base):
    """Who the invoice is from (the freelancer's business identity)."""

    name: Optional[str] = None
    business_name: Optional[str] = None
    address: Optional[str] = None
    vat_number: Optional[str] = None
    logo_url: Optional[str] = None


class InvoiceResponse(Base):
    id: uuid.UUID
    invoice_number: str
    status: InvoiceStatus
    currency: str
    issue_date: UTCDateTime
    due_date: UTCDateTime
    client_id: uuid.UUID
    project_id: uuid.UUID
    client: InvoiceParty
    project: InvoiceParty
    issuer: InvoiceIssuer
    items: list[InvoiceItemResponse]
    payments: list[PaymentResponse]
    subtotal: Money
    discount_rate: Decimal
    discount_amount: Money
    tax_rate: Decimal
    tax_amount: Money
    total: Money
    amount_paid: Money
    balance_due: Money
    is_overdue: bool
    notes: Optional[str] = None
    sent_at: Optional[UTCDateTime] = None
    viewed_at: Optional[UTCDateTime] = None
    payment_at: Optional[UTCDateTime] = Field(
        default=None, description="When the invoice became fully paid."
    )
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def display_status(self) -> InvoiceDisplayStatus:
        if self.is_overdue:
            return InvoiceDisplayStatus.OVERDUE
        return InvoiceDisplayStatus(self.status.value)


class InvoiceListResponse(Base):
    invoices: list[InvoiceResponse]
    total: int


class InvoiceEventResponse(Base):
    id: uuid.UUID
    invoice_id: uuid.UUID
    event_type: InvoiceEventType
    occurred_at: UTCDateTime
    detail: Optional[str] = None


class InvoiceEventListResponse(Base):
    events: list[InvoiceEventResponse]


class InvoiceSendResponse(Base):
    invoice: InvoiceResponse
    portal_url: str = Field(description="Client-facing link that opens the invoice.")
