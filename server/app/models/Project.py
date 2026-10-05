from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from datetime import date, datetime, timezone
from decimal import Decimal
import enum


from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.Expense import RecurrenceInterval

if TYPE_CHECKING:
    from app.models.ClientProfile import ClientProfile
    from app.models.TimeEntry import TimeEntry
    from app.models.Milestone import Milestone
    from app.models.Invoice import Invoice
    from app.models.ChangeRequest import ChangeRequest


class ProjectStatus(enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"
    CANCELLED = "CANCELLED"

class BillingType(enum.Enum):
    """How the project is billed. Milestones are optional for every type."""

    FIXED = "FIXED"
    HOURLY = "HOURLY"
    RETAINER = "RETAINER"
    MILESTONE = "MILESTONE"


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
    budget: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=True
    )
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    # Rate snapshot for hourly billing; time entries fall back to the
    # freelancer's rate when this is unset.
    hourly_rate: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=18, scale=4), nullable=True
    )
    billing_type: Mapped[BillingType] = mapped_column(
        Enum(BillingType), default=BillingType.FIXED
    )
    # Optional for every billing type; forced True for MILESTONE.
    milestones_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # RETAINER only: fixed amount billed every `retainer_interval`.
    retainer_amount: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(precision=18, scale=4), nullable=True
    )
    retainer_interval: Mapped[Optional[RecurrenceInterval]] = mapped_column(
        Enum(RecurrenceInterval), nullable=True
    )
    retainer_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # `total_time_spent_minutes` (SUM of time_entries.duration_minutes) is a
    # derived column_property attached in app/models/__init__.py; it is not
    # stored, so it cannot drift.

    # relationships
    client: Mapped["ClientProfile"] = relationship(back_populates="projects")
    time_entries: Mapped[list["TimeEntry"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="project")
    change_requests: Mapped[list["ChangeRequest"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )

    # foriegn keys
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    