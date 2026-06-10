import uuid
from datetime import datetime

from .Base import Base


class TimeEntryBase(Base):
    description: str
    start_time: datetime
    end_time: datetime
    is_billable: bool


class TimeEntryResponse(TimeEntryBase):
    id: uuid.UUID
    duration_minutes: int
    created_at: datetime
    updated_at: datetime
    is_invoiced: bool


class TimeEntryList(Base):
    time_entries: list[TimeEntryResponse]
    total: int


class TimeEntryCreate(TimeEntryBase):
    project_id: uuid.UUID
