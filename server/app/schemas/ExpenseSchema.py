import uuid
from datetime import date
from decimal import Decimal

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
    currency: CurrencyCode | None = Field(
        default=None, description="Defaults to the freelancer's currency."
    )
    category: str | None = Field(default=None, max_length=100)
    vendor: str | None = Field(default=None, max_length=255)
    project_id: uuid.UUID | None = None
    is_recurring: bool = False
    recurrence: RecurrenceInterval | None = None
    recurrence_ends_on: date | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ExpenseUpdate(_ExpenseRules):
    """PATCH /expenses/{id}: all fields optional."""

    description: str | None = Field(default=None, min_length=1, max_length=255)
    amount: PositiveMoney | None = None
    incurred_on: date | None = None
    currency: CurrencyCode | None = None
    category: str | None = Field(default=None, max_length=100)
    vendor: str | None = Field(default=None, max_length=255)
    project_id: uuid.UUID | None = None
    is_recurring: bool | None = None
    recurrence: RecurrenceInterval | None = None
    recurrence_ends_on: date | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ExpenseResponse(Base):
    id: uuid.UUID
    description: str
    amount: PositiveMoney
    currency: str
    incurred_on: date
    category: str | None = None
    vendor: str | None = None
    project_id: uuid.UUID | None = None
    is_recurring: bool
    recurrence: RecurrenceInterval | None = None
    recurrence_ends_on: date | None = None
    notes: str | None = None
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
    bank_balance: Decimal | None = None
    bank_balance_updated_at: UTCDateTime | None = None
    runway_months: Decimal | None = Field(
        default=None,
        description="bank balance / monthly burn; null when the balance is "
        "unknown or the burn is zero.",
    )
