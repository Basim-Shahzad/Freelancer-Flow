from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.models.Project import BudgetType, ProjectStatus
from .Base import Base


class ProjectCreate(Base):
    name: str
    client_id: uuid.UUID
    description: Optional[str] = None
    type: Optional[str] = None
    status: ProjectStatus = ProjectStatus.DRAFT
    budget: Optional[Decimal] = None
    budget_type: BudgetType = BudgetType.FIXED
    due_date: Optional[datetime] = None


class ProjectUpdate(Base):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    status: Optional[ProjectStatus] = None
    budget: Optional[Decimal] = None
    budget_type: Optional[BudgetType] = None
    due_date: Optional[datetime] = None
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
    due_date: Optional[datetime] = None
    client: ClientInProjectList
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(Base):
    projects: list[ProjectResponse]
    total: int
