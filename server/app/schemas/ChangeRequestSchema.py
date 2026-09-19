import uuid
from decimal import Decimal
from typing import Optional

from pydantic import Field

from app.models.ChangeRequest import ChangeRequestStatus

from .Base import Base
from .types import Money, UTCDateTime


class ChangeRequestCreate(Base):
    """POST /change-requests"""

    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    estimated_hours: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=8, decimal_places=2
    )
    estimated_amount: Optional[Money] = Field(
        default=None, description="Price of the change; omit while unpriced."
    )


class ChangeRequestUpdate(Base):
    """PATCH /change-requests/{id}

    Content can only be edited while PENDING. Setting ``status`` records the
    decision (APPROVED / REJECTED / WITHDRAWN); decisions are final.
    """

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    estimated_hours: Optional[Decimal] = Field(
        default=None, ge=0, max_digits=8, decimal_places=2
    )
    estimated_amount: Optional[Money] = None
    status: Optional[ChangeRequestStatus] = None
    decision_note: Optional[str] = Field(default=None, max_length=2000)


class ChangeRequestResponse(Base):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: ChangeRequestStatus
    estimated_hours: Optional[Decimal] = None
    estimated_amount: Optional[Money] = None
    requested_at: UTCDateTime
    decided_at: Optional[UTCDateTime] = None
    decision_note: Optional[str] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ChangeRequestListResponse(Base):
    change_requests: list[ChangeRequestResponse]
    total: int
