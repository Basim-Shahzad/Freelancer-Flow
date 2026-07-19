from __future__ import annotations
import uuid
from datetime import datetime, timezone
import enum

from sqlalchemy import DateTime, ForeignKey, String, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

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

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
