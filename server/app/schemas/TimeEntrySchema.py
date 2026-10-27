import uuid
from typing import Literal

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
    milestone_id: uuid.UUID | None = None
    hourly_rate: Money | None = Field(
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
    milestone_id: uuid.UUID | None = None
    is_billable: bool = True
    start_time: UTCDateTime | None = Field(
        default=None, description="Defaults to now. May not be in the future."
    )
    hourly_rate: Money | None = None


class TimeEntryUpdate(Base):
    """PATCH /time-entries/entry/{id}: all fields optional."""

    description: str | None = Field(default=None, min_length=1, max_length=255)
    start_time: UTCDateTime | None = None
    end_time: UTCDateTime | None = None
    is_billable: bool | None = None
    milestone_id: uuid.UUID | None = None
    hourly_rate: Money | None = None


class TimeEntryResponse(Base):
    id: uuid.UUID
    project_id: uuid.UUID
    milestone_id: uuid.UUID | None = None
    description: str
    start_time: UTCDateTime
    end_time: UTCDateTime | None = Field(
        default=None, description="null while the timer is running."
    )
    is_running: bool
    duration_minutes: int
    is_billable: bool
    is_invoiced: bool
    hourly_rate: Money | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class TimeEntryBulkSet(Base):
    """Fields a bulk edit may change. An explicit ``milestoneId: null`` clears it."""

    project_id: uuid.UUID | None = None
    milestone_id: uuid.UUID | None = None
    is_billable: bool | None = None
    description: str | None = Field(default=None, min_length=1, max_length=255)

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
    end_time: UTCDateTime | None = Field(
        default=None, description="null for a still-running timer."
    )
    project_id: uuid.UUID
    milestone_id: uuid.UUID | None = None
    description: str = Field(default="", max_length=255)
    is_billable: bool = True
    updated_at: UTCDateTime | None = Field(
        default=None,
        description="The server version the client last saw; omit for new entries.",
    )
    deleted: bool = False


class TimeEntrySyncRequest(Base):
    entries: list[TimeEntrySyncItem] = Field(max_length=200)


class TimeEntrySyncResult(Base):
    id: uuid.UUID
    status: Literal["created", "updated", "deleted", "conflict", "rejected"]
    reason: str | None = None
    warning: Literal["overlap"] | None = None
    entry: TimeEntryResponse | None = Field(
        default=None, description="Server copy after the sync, when one exists."
    )


class TimeEntrySyncResponse(Base):
    results: list[TimeEntrySyncResult]


class TimeEntryList(Base):
    time_entries: list[TimeEntryResponse]
    total: int
