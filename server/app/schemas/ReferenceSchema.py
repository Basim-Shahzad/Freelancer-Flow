from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .Base import Base
from .types import UTCDateTime


class ExchangeRatesValue(BaseModel):
    """Shape of the ``exchange_rates`` setting. Display-only reference data."""

    model_config = ConfigDict(extra="forbid")

    base: str = Field(default="USD", min_length=3, max_length=3)
    # Units of the currency per 1 unit of ``base``, kept as decimal strings.
    rates: dict[str, str] = Field(default_factory=dict)
    as_of: Optional[date] = Field(
        default=None, description="The provider's own update date for these rates."
    )
    source: Optional[str] = None
    fetched_at: Optional[UTCDateTime] = None
    manual_override: bool = False

    @field_validator("rates")
    @classmethod
    def _rates_are_positive_decimals(cls, rates: dict[str, str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for code, raw in rates.items():
            try:
                rate = Decimal(str(raw))
            except InvalidOperation:
                raise ValueError(f"Rate for {code} is not a number")
            if not rate.is_finite() or rate <= 0:
                raise ValueError(f"Rate for {code} must be positive")
            out[code.upper()] = str(raw)
        return out


class PublicExchangeRates(Base):
    """Rates as shown to API clients: no fetch bookkeeping."""

    base: str
    rates: dict[str, str]
    as_of: Optional[date] = None
    source: Optional[str] = None


class PaymentTextsValue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    esfca_purpose_of_payment: str = Field(min_length=1, max_length=255)


class ReferenceSettingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    key: str
    value: dict[str, Any]
    reference_date: Optional[date] = None
    notes: Optional[str] = None
    updated_at: UTCDateTime
    updated_by: Optional[uuid.UUID] = Field(
        default=None, description="Null means the system fetcher."
    )


class ReferenceSettingUpdate(BaseModel):
    value: dict[str, Any]
    reference_date: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=1000)
