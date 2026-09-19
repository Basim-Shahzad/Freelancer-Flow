import uuid
from decimal import Decimal
from typing import Optional

from pydantic import Field, HttpUrl

from .Base import Base
from .types import CurrencyCode, Money, Percent, UTCDateTime


class FreelancerProfileUpdate(Base):
    """PATCH /profile: all fields optional.

    Business identity is what invoices print (instead of the user's name).
    """

    hourly_rate: Optional[Money] = None
    type: Optional[str] = Field(default=None, max_length=255)
    currency: Optional[CurrencyCode] = None
    business_name: Optional[str] = Field(default=None, max_length=255)
    business_address: Optional[str] = Field(default=None, max_length=1000)
    vat_number: Optional[str] = Field(default=None, max_length=50)
    logo_url: Optional[HttpUrl] = None
    default_payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    default_tax_rate: Optional[Percent] = None
    bank_balance: Optional[Decimal] = Field(
        default=None, max_digits=13, decimal_places=2,
        description="Current cash position; stamps bankBalanceUpdatedAt.",
    )


class FreelancerProfileResponse(Base):
    id: uuid.UUID
    hourly_rate: Optional[Money] = None
    type: Optional[str] = None
    currency: str
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    vat_number: Optional[str] = None
    logo_url: Optional[str] = None
    default_payment_terms_days: int
    default_tax_rate: Decimal
    bank_balance: Optional[Decimal] = None
    bank_balance_updated_at: Optional[UTCDateTime] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
