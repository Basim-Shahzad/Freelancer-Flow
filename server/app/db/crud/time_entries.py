from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.freelancers import get_freelancer_by_user
from app.db.crud.projects import get_project_by_id
from app.models.Milestone import Milestone
from app.models.Project import Project
from app.models.TimeEntry import TimeEntry
from app.schemas.TimeEntrySchema import (
    TimeEntryCreate,
    TimeEntryStart,
    TimeEntryUpdate,
)
from app.services.invoicing import duration_minutes

# Tolerated client clock skew when validating "not in the future".
_FUTURE_TOLERANCE = timedelta(minutes=5)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    """SQLite (tests) returns naive datetimes; Postgres returns aware ones."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _resolve_rate(
    db: AsyncSession, project: Project, user_id: uuid.UUID, explicit
):
    """Rate snapshot: explicit > project > freelancer profile."""
    if explicit is not None:
        return explicit
    if project.hourly_rate is not None:
        return project.hourly_rate
    return (await get_freelancer_by_user(db, user_id)).hourly_rate


async def _check_milestone(
    db: AsyncSession, milestone_id: Optional[uuid.UUID], project_id: uuid.UUID
) -> None:
    if milestone_id is None:
        return
    found = (
        await db.execute(
            select(Milestone.id).where(
                Milestone.id == milestone_id, Milestone.project_id == project_id
            )
        )
    ).scalar_one_or_none()
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found on this project",
        )


async def get_time_entries(
    db: AsyncSession,
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[TimeEntry], int]:
    filters = [TimeEntry.project_id == project_id]

    total = (
        await db.execute(select(func.count(TimeEntry.id)).where(*filters))
    ).scalar_one()

    result = await db.execute(
        select(TimeEntry)
        .where(*filters)
        .order_by(TimeEntry.start_time.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_owned_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> TimeEntry:
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.id == entry_id,
            TimeEntry.project.has(Project.created_by == user_id),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found"
        )
    return entry


async def get_running_entry(
    db: AsyncSession, user_id: uuid.UUID
) -> Optional[TimeEntry]:
    result = await db.execute(
        select(TimeEntry).where(
            TimeEntry.user_id == user_id, TimeEntry.end_time.is_(None)
        )
    )
    return result.scalar_one_or_none()


async def create_time_entry(
    db: AsyncSession, data: TimeEntryCreate, user_id: uuid.UUID
) -> TimeEntry:
    """Log a completed block of time. Duration is derived, never client-supplied."""
    project = await get_project_by_id(db, data.project_id, user_id)
    await _check_milestone(db, data.milestone_id, project.id)
    if _aware(data.end_time) > _now() + _FUTURE_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="end_time cannot be in the future",
        )

    entry = TimeEntry(
        description=data.description,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=duration_minutes(data.start_time, data.end_time),
        is_billable=data.is_billable,
        hourly_rate=await _resolve_rate(db, project, user_id, data.hourly_rate),
        project_id=project.id,
        milestone_id=data.milestone_id,
        user_id=user_id,
    )
    db.add(entry)
    await db.flush()
    log_activity(
        db,
        user_id=user_id,
        entity_type="time_entry",
        entity_id=entry.id,
        action="created",
        summary=f"Logged {entry.duration_minutes} min on {project.name}",
    )
    await db.commit()
    await db.refresh(entry)
    return entry


async def start_timer(
    db: AsyncSession, data: TimeEntryStart, user_id: uuid.UUID
) -> TimeEntry:
    """Start a running timer. One running timer per user (also enforced by a
    partial unique index, which closes the race between concurrent starts)."""
    project = await get_project_by_id(db, data.project_id, user_id)
    await _check_milestone(db, data.milestone_id, project.id)

    if await get_running_entry(db, user_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A timer is already running; stop it first",
        )
    start = data.start_time or _now()
    if start > _now() + _FUTURE_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_time cannot be in the future",
        )

    entry = TimeEntry(
        description=data.description,
        start_time=start,
        end_time=None,
        duration_minutes=0,
        is_billable=data.is_billable,
        hourly_rate=await _resolve_rate(db, project, user_id, data.hourly_rate),
        project_id=project.id,
        milestone_id=data.milestone_id,
        user_id=user_id,
    )
    db.add(entry)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A timer is already running; stop it first",
        )
    log_activity(
        db,
        user_id=user_id,
        entity_type="time_entry",
        entity_id=entry.id,
        action="timer_started",
        summary=f"Started timer on {project.name}",
    )
    await db.commit()
    await db.refresh(entry)
    return entry


async def stop_timer(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> TimeEntry:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.end_time is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Timer is not running"
        )
    end = max(_now(), _aware(entry.start_time))
    entry.end_time = end
    entry.duration_minutes = duration_minutes(_aware(entry.start_time), end)
    log_activity(
        db,
        user_id=user_id,
        entity_type="time_entry",
        entity_id=entry.id,
        action="timer_stopped",
        summary=f"Stopped timer after {entry.duration_minutes} min",
    )
    await db.commit()
    await db.refresh(entry)
    return entry


async def update_time_entry(
    db: AsyncSession, entry_id: uuid.UUID, data: TimeEntryUpdate, user_id: uuid.UUID
) -> TimeEntry:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoiced time entries cannot be changed",
        )

    update_data = data.model_dump(exclude_unset=True)
    for required in ("description", "start_time", "is_billable", "end_time"):
        if required in update_data and update_data[required] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{required} cannot be null",
            )
    if "milestone_id" in update_data:
        await _check_milestone(db, update_data["milestone_id"], entry.project_id)

    start = _aware(update_data.get("start_time") or entry.start_time)
    end = update_data.get("end_time") or entry.end_time
    end = _aware(end) if end is not None else None
    if end is not None and end <= start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="end_time must be after start_time",
        )
    if end is not None and end > _now() + _FUTURE_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="end_time cannot be in the future",
        )

    changes = diff_changes(entry, update_data)
    for field, value in update_data.items():
        setattr(entry, field, value)
    entry.duration_minutes = duration_minutes(start, end) if end else 0
    if changes:
        log_activity(
            db,
            user_id=user_id,
            entity_type="time_entry",
            entity_id=entry.id,
            action="updated",
            summary="Edited time entry",
            changes=changes,
        )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Time entry conflict"
        )
    await db.refresh(entry)
    return entry


async def delete_time_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.is_invoiced:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoiced time entries cannot be deleted",
        )
    log_activity(
        db,
        user_id=user_id,
        entity_type="time_entry",
        entity_id=entry.id,
        action="deleted",
        summary="Deleted time entry",
    )
    await db.delete(entry)
    await db.commit()
