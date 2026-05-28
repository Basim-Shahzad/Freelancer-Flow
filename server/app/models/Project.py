from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from datetime import datetime, timezone
import enum


from sqlalchemy import DateTime, ForeignKey, String, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Client import Client


class ProjectStatus(enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    IN_REVIEW = "IN_REVIEW"
    INVOICED = "INVOICED"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"
    CANCELLED = "CANCELLED"


class BudgetType(enum.Enum):
    FIXED = "FIXED"
    HOURLY = "HOURLY"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(255), nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.DRAFT
    )
    budget: Mapped[float] = mapped_column(Numeric(precision=10, scale=2), nullable=True)
    budget_type: Mapped[BudgetType] = mapped_column(
        Enum(BudgetType), default=BudgetType.FIXED
    )
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # relationships
    client: Mapped["Client"] = relationship(back_populates="projects")

    # foriegn keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# TODO: add milestones to project
