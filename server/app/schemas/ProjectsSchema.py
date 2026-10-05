from __future__ import annotations
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field, computed_field, field_validator

from app.models.Expense import RecurrenceInterval
from app.models.Project import BillingType, ProjectStatus
from app.services.project_progress import compute_progress_percent
from .Base import Base
from .types import CurrencyCode, Money, PositiveMoney, UTCDateTime


_RETAINER_INTERVALS = (RecurrenceInterval.MONTHLY, RecurrenceInterval.QUARTERLY)


class _BillingRules(Base):
    @field_validator("retainer_interval", check_fields=False)
    @classmethod
    def _retainer_interval_supported(cls, v):
        if v is not None and v not in _RETAINER_INTERVALS:
            raise ValueError("retainer_interval must be MONTHLY or QUARTERLY")
        return v


class ProjectCreate(_BillingRules):
    name: str = Field(min_length=1, max_length=255)
    client_id: uuid.UUID
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, max_length=255)
    status: ProjectStatus = ProjectStatus.DRAFT
    budget: Optional[Money] = None
    billing_type: BillingType = BillingType.FIXED
    milestones_enabled: bool = Field(
        default=False, description="Always true for MILESTONE projects."
    )
    retainer_amount: Optional[PositiveMoney] = Field(
        default=None, description="RETAINER only; billed every `retainerInterval`."
    )
    retainer_interval: Optional[RecurrenceInterval] = Field(
        default=None, description="RETAINER only: MONTHLY or QUARTERLY."
    )
    retainer_start_date: Optional[date] = Field(
        default=None, description="RETAINER only; defaults to today."
    )
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to the client's, then the freelancer's currency."
    )
    hourly_rate: Optional[Money] = Field(
        default=None,
        description="Rate snapshot for hourly billing. Defaults to the freelancer's rate.",
    )
    due_date: Optional[UTCDateTime] = None


class ProjectUpdate(_BillingRules):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, max_length=255)
    status: Optional[ProjectStatus] = None
    budget: Optional[Money] = None
    billing_type: Optional[BillingType] = None
    milestones_enabled: Optional[bool] = None
    retainer_amount: Optional[PositiveMoney] = None
    retainer_interval: Optional[RecurrenceInterval] = None
    retainer_start_date: Optional[date] = None
    currency: Optional[CurrencyCode] = None
    hourly_rate: Optional[Money] = None
    due_date: Optional[UTCDateTime] = None
    client_id: Optional[uuid.UUID] = None

class ClientInProjectList(Base):
    id: uuid.UUID
    name: str

class ProjectResponse(Base):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    type: Optional[str] = None
    status: ProjectStatus
    budget: Optional[Decimal] = None
    billing_type: BillingType
    milestones_enabled: bool = False
    retainer_amount: Optional[Decimal] = None
    retainer_interval: Optional[RecurrenceInterval] = None
    retainer_start_date: Optional[date] = None
    currency: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    total_time_spent_minutes: int = Field(
        default=0, description="SUM of the project's time entries; derived, never stored."
    )
    milestone_total: int = Field(default=0, exclude=True)
    milestone_done: int = Field(default=0, exclude=True)
    client: ClientInProjectList
    created_at: datetime
    updated_at: datetime


    @computed_field(  # type: ignore[prop-decorator]
        description="0-100, derived: milestones (approved or submitted vs. total) when "
        "enabled, else hours vs. budget / hourlyRate for hourly projects; null otherwise."
    )
    @property
    def progress_percent(self) -> Optional[int]:
        return compute_progress_percent(
            billing_type=self.billing_type.value,
            milestones_enabled=self.milestones_enabled,
            milestone_total=self.milestone_total,
            milestone_done=self.milestone_done,
            budget=self.budget,
            hourly_rate=self.hourly_rate,
            total_minutes=self.total_time_spent_minutes,
        )


class ProjectListResponse(Base):
    projects: list[ProjectResponse]
    total: int
