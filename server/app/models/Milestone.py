from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.MilestoneApproval import MilestoneApproval
    from app.models.Project import Project
    from app.models.TimeEntry import TimeEntry


class MilestoneStatus(enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )

    project: Mapped[Project] = relationship(back_populates="milestones")
    # No delete cascade: deleting a milestone must never delete tracked
    # (possibly invoiced) time; the FK is SET NULL instead.
    time_entries: Mapped[list[TimeEntry]] = relationship(
        back_populates="milestone", passive_deletes=True
    )
    approvals: Mapped[list[MilestoneApproval]] = relationship(
        back_populates="milestone", cascade="all, delete-orphan"
    )

    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus), default=MilestoneStatus.PENDING
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Price billed when this milestone is invoiced; NULL for unpriced stages.
    amount: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=18, scale=4), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approval_required: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    # Cache of the latest decision, denormalized from `approvals` (the
    # MilestoneApproval history/audit table) for cheap reads. Always write
    # both a new MilestoneApproval row and these two fields together.
    approved_by_client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
