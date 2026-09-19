import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import Field, model_validator

from app.models.Expense import RecurrenceInterval

from .Base import Base
from .types import CurrencyCode, PositiveMoney, UTCDateTime


class _ExpenseRules(Base):
    """Shared recurrence consistency rules (applies to whatever is provided)."""

    @model_validator(mode="after")
    def _recurrence_rules(self):
        is_recurring = getattr(self, "is_recurring", None)
        recurrence = getattr(self, "recurrence", None)
        if is_recurring is True and recurrence is None:
            raise ValueError("recurrence is required when is_recurring is true")
        if is_recurring is False and recurrence is not None:
            raise ValueError("recurrence must be empty when is_recurring is false")
        ends = getattr(self, "recurrence_ends_on", None)
        start = getattr(self, "incurred_on", None)
        if ends is not None and start is not None and ends < start:
            raise ValueError("recurrence_ends_on cannot be before incurred_on")
        return self


class ExpenseCreate(_ExpenseRules):
    """POST /expenses"""

    description: str = Field(min_length=1, max_length=255)
    amount: PositiveMoney
    incurred_on: date
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to the freelancer's currency."
    )
    category: Optional[str] = Field(default=None, max_length=100)
    vendor: Optional[str] = Field(default=None, max_length=255)
    project_id: Optional[uuid.UUID] = None
    is_recurring: bool = False
    recurrence: Optional[RecurrenceInterval] = None
    recurrence_ends_on: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


class ExpenseUpdate(_ExpenseRules):
    """PATCH /expenses/{id}: all fields optional."""

    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    amount: Optional[PositiveMoney] = None
    incurred_on: Optional[date] = None
    currency: Optional[CurrencyCode] = None
    category: Optional[str] = Field(default=None, max_length=100)
    vendor: Optional[str] = Field(default=None, max_length=255)
    project_id: Optional[uuid.UUID] = None
    is_recurring: Optional[bool] = None
    recurrence: Optional[RecurrenceInterval] = None
    recurrence_ends_on: Optional[date] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


class ExpenseResponse(Base):
    id: uuid.UUID
    description: str
    amount: PositiveMoney
    currency: str
    incurred_on: date
    category: Optional[str] = None
    vendor: Optional[str] = None
    project_id: Optional[uuid.UUID] = None
    is_recurring: bool
    recurrence: Optional[RecurrenceInterval] = None
    recurrence_ends_on: Optional[date] = None
    notes: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ExpenseListResponse(Base):
    expenses: list[ExpenseResponse]
    total: int


class CashRunwayResponse(Base):
    """GET /expenses/runway: burn and months of runway.

    ``monthlyBurn`` = recurring costs normalised to a month + the average
    monthly one-off spend over the trailing ``lookbackMonths``. Amounts in
    the freelancer's currency; expenses in other currencies are excluded.
    """

    currency: str
    monthly_recurring: Decimal
    monthly_one_off_average: Decimal
    monthly_burn: Decimal
    lookback_months: int
    bank_balance: Optional[Decimal] = None
    bank_balance_updated_at: Optional[UTCDateTime] = None
    runway_months: Optional[Decimal] = Field(
        default=None,
        description="bank balance / monthly burn; null when the balance is "
        "unknown or the burn is zero.",
    )
