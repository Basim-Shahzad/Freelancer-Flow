from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from app.models.Project import BudgetType, ProjectStatus
from .Base import Base
from .types import CurrencyCode, Money, UTCDateTime


class ProjectCreate(Base):
    name: str = Field(min_length=1, max_length=255)
    client_id: uuid.UUID
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, max_length=255)
    status: ProjectStatus = ProjectStatus.DRAFT
    budget: Optional[Money] = None
    budget_type: BudgetType = BudgetType.FIXED
    currency: Optional[CurrencyCode] = Field(
        default=None, description="Defaults to the client's, then the freelancer's currency."
    )
    hourly_rate: Optional[Money] = Field(
        default=None,
        description="Rate snapshot for hourly billing. Defaults to the freelancer's rate.",
    )
    due_date: Optional[UTCDateTime] = None


class ProjectUpdate(Base):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, max_length=255)
    status: Optional[ProjectStatus] = None
    budget: Optional[Money] = None
    budget_type: Optional[BudgetType] = None
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
    budget_type: BudgetType
    currency: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    due_date: Optional[datetime] = None
    total_time_spent_minutes: int = Field(
        default=0, description="SUM of the project's time entries; derived, never stored."
    )
    client: ClientInProjectList
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(Base):
    projects: list[ProjectResponse]
    total: int
