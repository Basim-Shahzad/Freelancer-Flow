from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

from pydantic import ConfigDict, Field

from app.models.Milestone import MilestoneStatus

from .Base import Base
from .types import Money, UTCDateTime

# ── Request schemas ───────────────────────────────────────────────────────────


class MilestoneCreate(Base):
    """POST /milestones"""

    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    project_id: uuid.UUID
    due_date: Optional[UTCDateTime] = None
    approval_required: bool = False
    amount: Optional[Money] = Field(
        default=None, description="Money attached to the milestone (fixed-price billing)."
    )


class MilestoneUpdate(Base):
    """PATCH /milestones/{id}: all fields optional.

    ``status`` follows the allowed transition matrix; submitting for client
    approval goes through ``POST /milestones/{id}/submit`` instead.
    """

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    status: Optional[MilestoneStatus] = None
    due_date: Optional[UTCDateTime] = None
    approval_required: Optional[bool] = None
    amount: Optional[Money] = None
    sort_order: Optional[int] = Field(default=None, ge=0)


class MilestoneReorder(Base):
    """PUT /projects/{id}/milestones/order"""

    milestone_ids: list[uuid.UUID] = Field(
        min_length=1,
        description="Every milestone id of the project, in the desired order.",
    )


class MilestoneDecision(Base):
    """Body of the portal approve / reject endpoints."""

    comment: Optional[str] = Field(default=None, max_length=2000)


# ── Response schemas ──────────────────────────────────────────────────────────


class MilestoneResponse(Base):
    """Full read schema returned from the DB."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: Optional[str] = None
    status: MilestoneStatus
    due_date: Optional[datetime] = None
    approval_required: bool
    amount: Optional[Money] = None
    sort_order: int
    submitted_at: Optional[datetime] = None
    approved_by: Optional[uuid.UUID] = Field(
        default=None,
        validation_alias="approved_by_client_id",
        description="Client who made the latest approve/reject decision.",
    )
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class MilestoneListResponse(Base):
    """Paginated list wrapper."""

    model_config = ConfigDict(from_attributes=True)

    milestones: list[MilestoneResponse]
    total: int
