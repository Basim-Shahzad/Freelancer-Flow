from __future__ import annotations
import uuid
from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Project import Project
    from app.models.Milestone import Milestone


class TimeEntry(Base):
    __tablename__ = "time_entries"

    __table_args__ = (
        # A user can have at most one running timer (end_time IS NULL).
        Index(
            "uq_time_entries_one_running_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("end_time IS NULL"),
            sqlite_where=text("end_time IS NULL"),
        ),
        Index("ix_time_entries_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # NULL means the timer is still running.
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_minutes: Mapped[int] = mapped_column(nullable=False, default=0)

    is_billable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_invoiced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Rate snapshot taken when the entry is created, so later changes to a
    # profile/project rate never rewrite billing history.
    hourly_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=13, scale=2), nullable=True
    )

    # Foreign Keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    # SET NULL: deleting a milestone must not delete already-invoiced time.
    milestone_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("milestones.id", ondelete="SET NULL"), nullable=True
    )
    # Relationships
    project: Mapped["Project"] = relationship(back_populates="time_entries")
    milestone: Mapped[Optional["Milestone"]] = relationship(
        "Milestone", back_populates="time_entries"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @property
    def is_running(self) -> bool:
        return self.end_time is None
