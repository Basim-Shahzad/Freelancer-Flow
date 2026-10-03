import re
import uuid
from decimal import Decimal
from typing import Annotated, Literal, Optional
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

    hourly_rate: Optional[Money] = None
    type: Optional[str] = Field(default=None, max_length=255)
    currency: Optional[CurrencyCode] = None
    business_name: Optional[str] = Field(default=None, max_length=255)
    business_address: Optional[str] = Field(default=None, max_length=1000)
    country: Optional[str] = Field(
        default=None, pattern=r"^[A-Z]{2}$", description="ISO-3166 alpha-2; informational only."
    )
    timezone: Optional[TimezoneName] = None
    tax_registration_number: Optional[str] = Field(default=None, max_length=100)
    tax_label: Optional[str] = Field(default=None, max_length=50)
    tax_basis: Optional[Literal["accrual", "cash"]] = None
    payment_instructions: Optional[ClientFacingText] = Field(
        default=None, max_length=2000,
        description="Default payment instructions copied onto new invoices.",
    )
    invoice_number_format: Optional[InvoiceNumberFormat] = None
    logo_url: Optional[HttpUrl] = None
    default_payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    default_taxes: Optional[list[TaxInput]] = Field(
        default=None, max_length=10,
        description="Taxes applied to new invoices unless overridden; [] for none.",
    )
    bank_balance: Optional[Decimal] = Field(
        default=None, max_digits=18, decimal_places=4,
        description="Current cash position; stamps bankBalanceUpdatedAt.",
    )


class FreelancerProfileResponse(Base):
    id: uuid.UUID
    hourly_rate: Optional[Money] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    country: Optional[str] = None
    timezone: str
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    tax_registration_number: Optional[str] = None
    tax_label: Optional[str] = None
    tax_basis: str
    payment_instructions: Optional[str] = None
    invoice_number_format: str
    logo_url: Optional[str] = None
    default_payment_terms_days: int
    default_taxes: list[TaxInput] = Field(default_factory=list)
    bank_balance: Optional[Decimal] = None
    bank_balance_updated_at: Optional[UTCDateTime] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
