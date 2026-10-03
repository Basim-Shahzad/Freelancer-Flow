import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import Field, model_validator

from .Base import Base
from .types import CurrencyCode, PositiveMoney, UTCDateTime


class TaxRemittanceCreate(Base):
    """POST /tax/remittances: record a tax payment already made to an authority."""

    period_start: date
    period_end: date
    amount: PositiveMoney
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to the freelancer's currency."
    )
    paid_at: Optional[UTCDateTime] = Field(default=None, description="Defaults to now.")
    tax_name: Optional[str] = Field(
        default=None, max_length=100,
        description="Which tax this settles; omit to settle all collected tax.",
    )
    period_label: Optional[str] = Field(default=None, max_length=50)
    reference: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _period(self) -> "TaxRemittanceCreate":
        if self.period_end < self.period_start:
            raise ValueError("period_end cannot be before period_start")
        return self


class TaxRemittanceResponse(Base):
    id: uuid.UUID
    period_start: date
    period_end: date
    amount: PositiveMoney
    currency: str
    tax_name: Optional[str] = None
    period_label: Optional[str] = None
    paid_at: UTCDateTime
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: UTCDateTime


class TaxRemittanceListResponse(Base):
    remittances: list[TaxRemittanceResponse]
    total: int


class TaxSummaryResponse(Base):
    """GET /tax/summary

    ``taxCollected`` is the tax on invoices in the period: on the accrual basis
    those issued in it, on the cash basis those fully paid in it (per the
    profile's ``taxBasis``). ``taxRemitted`` sums remittances whose period ends
    in it; ``taxOutstanding`` is the difference (never negative). Withholding
    is not tax collected and is excluded.
    """

    period_start: date
    period_end: date
    currency: str
    basis: str
    tax_name: Optional[str] = None
    tax_collected: Decimal
    tax_remitted: Decimal
    tax_outstanding: Decimal
