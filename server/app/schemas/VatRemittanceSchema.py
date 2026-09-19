import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import Field, model_validator

from .Base import Base
from .types import CurrencyCode, PositiveMoney, UTCDateTime


class VatRemittanceCreate(Base):
    """POST /vat/remittances: record a VAT payment already made to the authority."""

    period_start: date
    period_end: date
    amount: PositiveMoney
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to the freelancer's currency."
    )
    paid_at: Optional[UTCDateTime] = Field(default=None, description="Defaults to now.")
    reference: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _period(self) -> "VatRemittanceCreate":
        if self.period_end < self.period_start:
            raise ValueError("period_end cannot be before period_start")
        return self


class VatRemittanceResponse(Base):
    id: uuid.UUID
    period_start: date
    period_end: date
    amount: PositiveMoney
    currency: str
    paid_at: UTCDateTime
    reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: UTCDateTime


class VatRemittanceListResponse(Base):
    remittances: list[VatRemittanceResponse]
    total: int


class VatSummaryResponse(Base):
    """GET /vat/summary

    ``vatCollected`` is the tax on non-draft, non-cancelled invoices issued in
    the period; ``vatRemitted`` is the sum of remittances whose period ends in
    it; ``vatOutstanding`` is the difference (never negative).
    """

    period_start: date
    period_end: date
    currency: str
    vat_collected: Decimal
    vat_remitted: Decimal
    vat_outstanding: Decimal
