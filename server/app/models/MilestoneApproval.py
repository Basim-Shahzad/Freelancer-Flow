from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from datetime import datetime, timezone
import enum

from sqlalchemy import DateTime, ForeignKey, String, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.Milestone import Milestone
    from app.models.ClientProfile import ClientProfile
    from app.models.PortalAccessToken import PortalAccessToken


class MilestoneApprovalDecision(enum.Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class MilestoneApproval(Base):
    __tablename__ = "milestone_approvals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("milestones.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    decision: Mapped[MilestoneApprovalDecision] = mapped_column(
        Enum(MilestoneApprovalDecision), nullable=False
    )
    decided_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ip_address: Mapped[str] = mapped_column(String(255), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=True)

    # FK to the token used for this action
    access_token_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portal_tokens.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    milestone: Mapped["Milestone"] = relationship(back_populates="approvals")
    client: Mapped["ClientProfile"] = relationship()
    access_token: Mapped["PortalAccessToken | None"] = relationship()

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
