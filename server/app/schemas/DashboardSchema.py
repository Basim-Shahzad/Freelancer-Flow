from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from pydantic import Field

from .Base import Base
from .types import Money, UTCDateTime


class CurrencyAmount(Base):
    currency: str
    amount: Money


class CashIn(Base):
    """Recorded payments by month in the freelancer's timezone, never converted."""

    this_month: list[CurrencyAmount]
    last_month: list[CurrencyAmount]
    this_month_start: date
    last_month_start: date
    timezone: str


class OutstandingByCurrency(Base):
    currency: str
    balance: Money = Field(description="Unpaid balance across open invoices.")
    count: int
    overdue_balance: Money
    overdue_count: int


class Outstanding(Base):
    by_currency: list[OutstandingByCurrency]


class UnbilledTime(Base):
    project_id: uuid.UUID
    project_name: str
    currency: str | None = None
    hours: Decimal = Field(description="Finished, billable, uninvoiced hours.")
    amount: Money = Field(description="At each entry's rate snapshot; entries with no rate add 0.")


class UnbilledMilestones(Base):
    project_id: uuid.UUID
    project_name: str
    currency: str | None = None
    count: int
    amount: Money


class UnbilledRetainerPeriod(Base):
    project_id: uuid.UUID
    project_name: str
    currency: str | None = None
    period_start: date
    period_end: date
    label: str
    amount: Money


class Unbilled(Base):
    time: list[UnbilledTime]
    milestones: list[UnbilledMilestones]
    retainer_periods: list[UnbilledRetainerPeriod]


class RunningTimer(Base):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    description: str
    start_time: UTCDateTime
    elapsed_minutes: int


class DashboardSummary(Base):
    cash_in: CashIn
    outstanding: Outstanding
    unbilled: Unbilled
    running_timer: RunningTimer | None = None
    active_projects: int
