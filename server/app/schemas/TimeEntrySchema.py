import uuid
from typing import Optional

from pydantic import Field, model_validator

from .Base import Base
from .types import Money, UTCDateTime


class TimeEntryCreate(Base):
    """POST /time-entries: log a *completed* block of time."""

    description: str = Field(min_length=1, max_length=255)
    start_time: UTCDateTime
    end_time: UTCDateTime
    is_billable: bool = True
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    hourly_rate: Optional[Money] = Field(
        default=None,
        description="Rate snapshot for this entry. Defaults to the project's rate, "
        "then the freelancer's profile rate.",
    )

    @model_validator(mode="after")
    def _end_after_start(self) -> "TimeEntryCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TimeEntryStart(Base):
    """POST /time-entries/start: start a running timer."""

    description: str = Field(min_length=1, max_length=255)
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    is_billable: bool = True
    start_time: Optional[UTCDateTime] = Field(
        default=None, description="Defaults to now. May not be in the future."
    )
    hourly_rate: Optional[Money] = None


class TimeEntryUpdate(Base):
    """PATCH /time-entries/entry/{id}: all fields optional."""

    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    start_time: Optional[UTCDateTime] = None
    end_time: Optional[UTCDateTime] = None
    is_billable: Optional[bool] = None
    milestone_id: Optional[uuid.UUID] = None
    hourly_rate: Optional[Money] = None


class TimeEntryResponse(Base):
    id: uuid.UUID
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    description: str
    start_time: UTCDateTime
    end_time: Optional[UTCDateTime] = Field(
        default=None, description="null while the timer is running."
    )
    is_running: bool
    duration_minutes: int
    is_billable: bool
    is_invoiced: bool
    hourly_rate: Optional[Money] = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class TimeEntryList(Base):
    time_entries: list[TimeEntryResponse]
    total: int
