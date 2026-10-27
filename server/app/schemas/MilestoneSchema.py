from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import ConfigDict, Field

from app.models.Milestone import MilestoneStatus

from .Base import Base
from .types import Money, UTCDateTime

# ── Request schemas ───────────────────────────────────────────────────────────


class MilestoneCreate(Base):
    """POST /milestones"""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    project_id: uuid.UUID
    due_date: UTCDateTime | None = None
    approval_required: bool = False
    amount: Money | None = Field(
        default=None, description="Money attached to the milestone (fixed-price billing)."
    )


class MilestoneUpdate(Base):
    """PATCH /milestones/{id}: all fields optional.

    ``status`` follows the allowed transition matrix; submitting for client
    approval goes through ``POST /milestones/{id}/submit`` instead.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    status: MilestoneStatus | None = None
    due_date: UTCDateTime | None = None
    approval_required: bool | None = None
    amount: Money | None = None
    sort_order: int | None = Field(default=None, ge=0)


class MilestoneReorder(Base):
    """PUT /projects/{id}/milestones/order"""

    milestone_ids: list[uuid.UUID] = Field(
        min_length=1,
        description="Every milestone id of the project, in the desired order.",
    )


class MilestoneDecision(Base):
    """Body of the portal approve / reject endpoints."""

    comment: str | None = Field(default=None, max_length=2000)


# ── Response schemas ──────────────────────────────────────────────────────────


class MilestoneResponse(Base):
    """Full read schema returned from the DB."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None = None
    status: MilestoneStatus
    due_date: datetime | None = None
    approval_required: bool
    amount: Money | None = None
    sort_order: int
    submitted_at: datetime | None = None
    approved_by: uuid.UUID | None = Field(
        default=None,
        validation_alias="approved_by_client_id",
        description="Client who made the latest approve/reject decision.",
    )
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class MilestoneListResponse(Base):
    """Paginated list wrapper."""

    model_config = ConfigDict(from_attributes=True)

    milestones: list[MilestoneResponse]
    total: int
