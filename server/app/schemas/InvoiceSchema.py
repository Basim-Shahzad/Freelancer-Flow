from __future__ import annotations

import enum
import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import Field, computed_field, field_validator, model_validator

from app.models.Invoice import InvoiceStatus
from app.models.InvoiceEvent import InvoiceEventType
from app.models.PaymentMethodConfig import PaymentMethodType

from .Base import Base
from .PaymentSchema import PaymentResponse
from .TaxSchema import TaxInput, TaxLineResponse
from .types import ClientFacingText, CurrencyCode, Money, Percent, UTCDateTime

# Money Rule: shown with every payment-instructions block.
PAYMENT_DISCLAIMER = (
    "Paylancr does not process payments. "
    "Pay the freelancer directly using the details below."
)


class InvoiceDisplayStatus(str, enum.Enum):
    """Status as shown to users: the stored status plus derived ``OVERDUE``."""

    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    WRITTEN_OFF = "WRITTEN_OFF"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"


# ── Requests ──────────────────────────────────────────────────────────────────


class InvoiceItemCreate(Base):
    """A manually entered line item."""

    description: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=2, default=Decimal(1))
    unit_price: Money


class InvoiceCreate(Base):
    """POST /invoices

    Lines can come from any mix of manual ``items``, un-invoiced billable
    ``timeEntryIds`` (billed at each entry's rate snapshot) and
    ``milestoneIds`` (billed at the milestone amount). At least one line is
    required.
    """

    project_id: uuid.UUID
    issue_date: UTCDateTime | None = Field(default=None, description="Defaults to now.")
    due_date: UTCDateTime | None = Field(
        default=None,
        description="Defaults to issue date + client payment terms (or the "
        "freelancer's default terms).",
    )
    currency: CurrencyCode | None = Field(
        default=None, description="Defaults to project, client, then freelancer currency."
    )
    taxes: list[TaxInput] | None = Field(
        default=None,
        max_length=10,
        description="Taxes to apply. Omit to use the profile's default taxes; "
        "[] for none.",
    )
    tax_note: str | None = Field(
        default=None, max_length=500,
        description="Printed when no tax applies (exempt, reverse charge...).",
    )
    discount_rate: Percent = Decimal(0)
    notes: ClientFacingText | None = Field(default=None, max_length=5000)
    payment_instructions: ClientFacingText | None = Field(
        default=None, max_length=2000,
        description="How the client should pay (e.g. bank account / IBAN). "
        "Omit to use the profile's default; null for none.",
    )
    payment_method_ids: list[uuid.UUID] | None = Field(
        default=None,
        max_length=20,
        description="Payment methods to show the client (snapshotted). Omit to use "
        "your active default methods; [] for none.",
    )
    items: list[InvoiceItemCreate] = Field(default_factory=list, max_length=200)
    time_entry_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    milestone_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    retainer_period_start: date | None = Field(
        default=None,
        description="RETAINER projects only: start date of the period to bill. Adds "
        "a 'Retainer — <period>' line at the retainer amount. Must be one of the "
        "project's period starts that has already begun (billing is in advance).",
    )

    @model_validator(mode="after")
    def _validate(self) -> InvoiceCreate:
        if not (
            self.items
            or self.time_entry_ids
            or self.milestone_ids
            or self.retainer_period_start
        ):
            raise ValueError(
                "An invoice needs at least one item, time entry, milestone or "
                "retainer period"
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

    issue_date: UTCDateTime | None = None
    due_date: UTCDateTime | None = None
    taxes: list[TaxInput] | None = Field(default=None, max_length=10)
    tax_note: str | None = Field(default=None, max_length=500)
    discount_rate: Percent | None = None
    notes: ClientFacingText | None = Field(default=None, max_length=5000)
    payment_instructions: ClientFacingText | None = Field(default=None, max_length=2000)
    payment_method_ids: list[uuid.UUID] | None = Field(
        default=None,
        max_length=20,
        description="Replaces the snapshotted payment methods. [] for none.",
    )


class InvoiceWriteOff(Base):
    """POST /invoices/{id}/write-off"""

    reason: str = Field(min_length=1, max_length=500)


# ── Responses ─────────────────────────────────────────────────────────────────


class InvoiceItemResponse(Base):
    id: uuid.UUID
    description: str
    quantity: Decimal
    unit_price: Money
    amount: Money
    time_entry_id: uuid.UUID | None = None
    milestone_id: uuid.UUID | None = None


class InvoicePaymentMethodResponse(Base):
    """A snapshotted payment method (details are the freelancer's, as issued)."""

    id: uuid.UUID
    type: PaymentMethodType
    label: str
    currency: str | None = None
    details: dict[str, Any]

    @field_validator("details", mode="before")
    @classmethod
    def _parse_details(cls, v):
        return json.loads(v) if isinstance(v, str) else v

    @computed_field  # type: ignore[prop-decorator]
    @property
    def pay_link(self) -> str | None:
        """Payoneer payment-request link: a link-out only, never a charge."""
        if self.type == PaymentMethodType.PAYONEER:
            return self.details.get("paymentRequestUrl")
        return None


class InvoiceParty(Base):
    id: uuid.UUID
    name: str


class InvoiceIssuer(Base):
    """Who the invoice is from (the freelancer's business identity)."""

    name: str | None = None
    business_name: str | None = None
    address: str | None = None
    tax_registration_number: str | None = None
    tax_label: str | None = None
    logo_url: str | None = None


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
    retainer_period_start: date | None = None
    issuer: InvoiceIssuer
    items: list[InvoiceItemResponse]
    payments: list[PaymentResponse]
    payment_methods: list[InvoicePaymentMethodResponse]
    subtotal: Money
    discount_rate: Decimal
    discount_amount: Money
    taxes: list[TaxLineResponse]
    tax_note: str | None = None
    tax_amount: Money
    withholding_amount: Money
    total: Money
    amount_paid: Money
    balance_due: Money
    is_overdue: bool
    notes: str | None = None
    payment_instructions: str | None = None
    sent_at: UTCDateTime | None = None
    viewed_at: UTCDateTime | None = None
    payment_at: UTCDateTime | None = Field(
        default=None, description="When the invoice became fully paid."
    )
    created_at: UTCDateTime
    updated_at: UTCDateTime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def payment_disclaimer(self) -> str:
        return PAYMENT_DISCLAIMER

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
    detail: str | None = None


class InvoiceEventListResponse(Base):
    events: list[InvoiceEventResponse]


ShareChannel = Literal["email", "whatsapp", "link"]


class InvoiceSendRequest(Base):
    channel: ShareChannel = Field(
        default="email",
        description="`email` sends mail; `whatsapp` and `link` only return links. "
        "All three move a DRAFT to SENT.",
    )


class InvoiceShareLinks(Base):
    portal_url: str = Field(description="Client-facing link that opens the invoice.")
    pdf_url: str = Field(description="Token-based PDF link the client can open.")
    whatsapp_url: str = Field(
        description="`wa.me` link with the message prefilled (no number if the "
        "client has no WhatsApp number)."
    )


class InvoiceSendResponse(InvoiceShareLinks):
    invoice: InvoiceResponse
    email_delivered: bool | None = Field(
        default=None,
        description="Null when no email was attempted. False when it could not be "
        "sent (see the EMAIL_FAILED event); the links still work.",
    )
