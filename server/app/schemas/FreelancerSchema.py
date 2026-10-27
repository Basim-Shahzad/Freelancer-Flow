import re
import uuid
from decimal import Decimal
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, Field, HttpUrl

from .Base import Base
from .TaxSchema import TaxInput
from .types import ClientFacingText, CurrencyCode, Money, UTCDateTime


def _check_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ValueError, OSError, LookupError) as exc:
        raise ValueError(f"{value} is not a valid IANA timezone") from exc
    return value


TimezoneName = Annotated[str, AfterValidator(_check_timezone), Field(max_length=64)]


def _check_number_format(value: str) -> str:
    # Only {seq}, {seq:04d}-style padding and {year}; no attribute access.
    stripped = re.sub(r"\{seq(:0?\d{1,2}d)?\}|\{year\}", "", value)
    if "{" in stripped or "}" in stripped:
        raise ValueError('use only the {seq} and {year} tokens, e.g. "INV-{seq:04d}"')
    try:
        rendered = value.format(seq=1, year=2000)
    except (KeyError, IndexError, ValueError) as exc:
        raise ValueError('use only the {seq} and {year} tokens, e.g. "INV-{seq:04d}"') from exc
    if "{seq" not in value:
        raise ValueError("the format must contain {seq}")
    if len(rendered) > 50 or len(value.format(seq=10**9, year=2000)) > 50:
        raise ValueError("invoice numbers are limited to 50 characters")
    return value


InvoiceNumberFormat = Annotated[str, AfterValidator(_check_number_format), Field(max_length=100)]


class FreelancerProfileUpdate(Base):
    """PATCH /profile: all fields optional.

    Business identity is what invoices print (instead of the user's name).
    """

    hourly_rate: Money | None = None
    type: str | None = Field(default=None, max_length=255)
    currency: CurrencyCode | None = None
    business_name: str | None = Field(default=None, max_length=255)
    business_address: str | None = Field(default=None, max_length=1000)
    country: str | None = Field(
        default=None, pattern=r"^[A-Z]{2}$", description="ISO-3166 alpha-2; informational only."
    )
    timezone: TimezoneName | None = None
    tax_registration_number: str | None = Field(default=None, max_length=100)
    tax_label: str | None = Field(default=None, max_length=50)
    tax_basis: Literal["accrual", "cash"] | None = None
    payment_instructions: ClientFacingText | None = Field(
        default=None, max_length=2000,
        description="Default payment instructions copied onto new invoices.",
    )
    invoice_number_format: InvoiceNumberFormat | None = None
    logo_url: HttpUrl | None = None
    default_payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    default_taxes: list[TaxInput] | None = Field(
        default=None, max_length=10,
        description="Taxes applied to new invoices unless overridden; [] for none.",
    )
    bank_balance: Decimal | None = Field(
        default=None, max_digits=18, decimal_places=4,
        description="Current cash position; stamps bankBalanceUpdatedAt.",
    )


class FreelancerProfileResponse(Base):
    id: uuid.UUID
    hourly_rate: Money | None = None
    type: str | None = None
    currency: str | None = None
    country: str | None = None
    timezone: str
    business_name: str | None = None
    business_address: str | None = None
    tax_registration_number: str | None = None
    tax_label: str | None = None
    tax_basis: str
    payment_instructions: str | None = None
    invoice_number_format: str
    logo_url: str | None = None
    default_payment_terms_days: int
    default_taxes: list[TaxInput] = Field(default_factory=list)
    bank_balance: Decimal | None = None
    bank_balance_updated_at: UTCDateTime | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
