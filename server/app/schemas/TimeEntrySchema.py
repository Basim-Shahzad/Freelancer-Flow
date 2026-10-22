import uuid
from typing import Literal, Optional

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


class TimeEntryBulkSet(Base):
    """Fields a bulk edit may change. An explicit ``milestoneId: null`` clears it."""

    project_id: Optional[uuid.UUID] = None
    milestone_id: Optional[uuid.UUID] = None
    is_billable: Optional[bool] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def _non_empty(self) -> "TimeEntryBulkSet":
        if not self.model_fields_set:
            raise ValueError("set must contain at least one field")
        for name in ("project_id", "is_billable", "description"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class TimeEntryBulkUpdate(Base):
    """PATCH /time-entries/bulk"""

    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    set: TimeEntryBulkSet


class TimeEntryBulkResult(Base):
    updated: int
    ids: list[uuid.UUID]


class TimeEntrySyncItem(Base):
    """One entry recorded offline, keyed by a client-generated UUID."""

    id: uuid.UUID
    start_time: UTCDateTime
    end_time: Optional[UTCDateTime] = Field(
        default=None, description="null for a still-running timer."
    )
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    description: str = Field(default="", max_length=255)
    is_billable: bool = True
    updated_at: Optional[UTCDateTime] = Field(
        default=None,
        description="The server version the client last saw; omit for new entries.",
    )
    deleted: bool = False


class TimeEntrySyncRequest(Base):
    entries: list[TimeEntrySyncItem] = Field(max_length=200)


class TimeEntrySyncResult(Base):
    id: uuid.UUID
    status: Literal["created", "updated", "deleted", "conflict", "rejected"]
    reason: Optional[str] = None
    warning: Optional[Literal["overlap"]] = None
    entry: Optional[TimeEntryResponse] = Field(
        default=None, description="Server copy after the sync, when one exists."
    )


class TimeEntrySyncResponse(Base):
    results: list[TimeEntrySyncResult]


class TimeEntryList(Base):
    time_entries: list[TimeEntryResponse]
    total: int
