from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.Milestone import MilestoneStatus

# ── Base ──────────────────────────────────────────────────────────────────────


class MilestoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: uuid.UUID
    status: MilestoneStatus = MilestoneStatus.PENDING
    due_date: Optional[datetime] = None
    approval_required: bool = False


# ── Request schemas ───────────────────────────────────────────────────────────


class MilestoneCreate(MilestoneBase):
    """POST /milestones"""

    pass


class MilestoneUpdate(BaseModel):
    """PATCH /milestones/{id}  — all fields optional"""

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[MilestoneStatus] = None
    due_date: Optional[datetime] = None
    approval_required: Optional[bool] = None


class MilestoneApprove(BaseModel):
    """POST /milestones/{id}/approve"""

    approved_by: uuid.UUID


# ── Response schemas ──────────────────────────────────────────────────────────


class MilestoneResponse(MilestoneBase):
    """Full read schema returned from the DB."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class MilestoneListResponse(BaseModel):
    """Paginated list wrapper."""

    model_config = ConfigDict(from_attributes=True)

    milestones: list[MilestoneResponse]
    total: int
