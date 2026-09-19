from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from datetime import datetime, timezone
import enum

from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Project import Project
    from app.models.TimeEntry import TimeEntry
    from app.models.MilestoneApproval import MilestoneApproval


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

    project: Mapped["Project"] = relationship(back_populates="milestones")
    # No delete cascade: deleting a milestone must never delete tracked
    # (possibly invoiced) time; the FK is SET NULL instead.
    time_entries: Mapped[list["TimeEntry"]] = relationship(
        back_populates="milestone", passive_deletes=True
    )
    approvals: Mapped[list["MilestoneApproval"]] = relationship(
        back_populates="milestone", cascade="all, delete-orphan"
    )

    status: Mapped[MilestoneStatus] = mapped_column(
        Enum(MilestoneStatus), default=MilestoneStatus.PENDING
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    # Fixed-price billing is milestone-based, so the milestone carries the money.
    amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=13, scale=2), nullable=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
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
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
