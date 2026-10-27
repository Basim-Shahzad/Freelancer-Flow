from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound, Unprocessable
from app.db.crud.activity import log_activity
from app.db.crud.freelancers import get_freelancer_by_user
from app.db.crud.projects import get_project_by_id
from app.models.Milestone import Milestone
from app.models.Project import Project
from app.models.TimeEntry import TimeEntry
from app.schemas.TimeEntrySchema import (
    TimeEntryBulkUpdate,
    TimeEntryCreate,
    TimeEntryResponse,
    TimeEntryStart,
    TimeEntrySyncItem,
    TimeEntryUpdate,
)
from app.services.invoicing import duration_minutes
from app.services.time_tracking import (
    FUTURE_TOLERANCE,
    aware,
    overlaps,
    validate_window,
)

_FUTURE_TOLERANCE = FUTURE_TOLERANCE
_aware = aware


def _now() -> datetime:
    return datetime.now(UTC)


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
    db: AsyncSession, milestone_id: uuid.UUID | None, project_id: uuid.UUID
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
        raise NotFound("Milestone not found on this project")


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
        raise NotFound("Time entry not found")
    return entry


async def get_running_entry(
    db: AsyncSession, user_id: uuid.UUID
) -> TimeEntry | None:
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
        raise Unprocessable("end_time cannot be in the future")

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
        raise Conflict("A timer is already running; stop it first")
    start = data.start_time or _now()
    if start > _now() + _FUTURE_TOLERANCE:
        raise Unprocessable("start_time cannot be in the future")

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
        raise Conflict("A timer is already running; stop it first")
    await db.commit()
    await db.refresh(entry)
    return entry


async def stop_timer(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> TimeEntry:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.end_time is not None:
        raise Conflict("Timer is not running")
    end = max(_now(), _aware(entry.start_time))
    entry.end_time = end
    entry.duration_minutes = duration_minutes(_aware(entry.start_time), end)
    await db.commit()
    await db.refresh(entry)
    return entry


async def update_time_entry(
    db: AsyncSession, entry_id: uuid.UUID, data: TimeEntryUpdate, user_id: uuid.UUID
) -> TimeEntry:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.is_invoiced:
        raise Conflict("Invoiced time entries cannot be changed")

    update_data = data.model_dump(exclude_unset=True)
    for required in ("description", "start_time", "is_billable", "end_time"):
        if required in update_data and update_data[required] is None:
            raise Unprocessable(f"{required} cannot be null")
    if "milestone_id" in update_data:
        await _check_milestone(db, update_data["milestone_id"], entry.project_id)

    start = _aware(update_data.get("start_time") or entry.start_time)
    end = update_data.get("end_time") or entry.end_time
    end = _aware(end) if end is not None else None
    if end is not None and end <= start:
        raise Unprocessable("end_time must be after start_time")
    if end is not None and end > _now() + _FUTURE_TOLERANCE:
        raise Unprocessable("end_time cannot be in the future")

    # Routine edits are not audited; only invoice linking, deletes and batches are.
    for field, value in update_data.items():
        setattr(entry, field, value)
    entry.duration_minutes = duration_minutes(start, end) if end else 0
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise Conflict("Time entry conflict")
    await db.refresh(entry)
    return entry


async def delete_time_entry(
    db: AsyncSession, entry_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    entry = await get_owned_entry(db, entry_id, user_id)
    if entry.is_invoiced:
        raise Conflict("Invoiced time entries cannot be deleted")
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


ID_CAP = 20  # ids kept in a batch summary row


async def bulk_update_time_entries(
    db: AsyncSession, data: TimeEntryBulkUpdate, user_id: uuid.UUID
) -> list[TimeEntry]:
    """All-or-nothing edit of many entries; one summary activity row."""
    ids = list(dict.fromkeys(data.ids))
    entries = list(
        (
            await db.execute(
                select(TimeEntry).where(
                    TimeEntry.id.in_(ids), TimeEntry.user_id == user_id
                )
            )
        )
        .scalars()
        .all()
    )
    if len(entries) != len(ids):
        raise NotFound("Time entry not found")

    changes = data.set.model_dump(exclude_unset=True)
    if any(e.is_invoiced for e in entries) and set(changes) - {"description"}:
        raise Conflict("Invoiced time entries can only have their description changed")

    project: Project | None = None
    if "project_id" in changes:
        project = await get_project_by_id(db, changes["project_id"], user_id)
        if "milestone_id" not in changes and any(
            e.milestone_id is not None and e.project_id != project.id for e in entries
        ):
            raise Unprocessable(
                "milestone_id must be set when moving entries that have a milestone "
                "to another project"
            )

    milestone_id = changes.get("milestone_id")
    if milestone_id is not None:
        milestone_project = (
            await db.execute(
                select(Milestone.project_id)
                .join(Project, Project.id == Milestone.project_id)
                .where(Milestone.id == milestone_id, Project.created_by == user_id)
            )
        ).scalar_one_or_none()
        if milestone_project is None:
            raise NotFound("Milestone not found")
        targets = {project.id} if project else {e.project_id for e in entries}
        if targets != {milestone_project}:
            raise Unprocessable("Milestone does not belong to the target project")

    for entry in entries:
        if project is not None and entry.project_id != project.id:
            entry.project_id = project.id
            entry.hourly_rate = await _resolve_rate(db, project, user_id, None)
        for field in ("description", "is_billable", "milestone_id"):
            if field in changes:
                setattr(entry, field, changes[field])

    log_activity(
        db,
        user_id=user_id,
        entity_type="time_entry",
        entity_id=entries[0].id,
        action="bulk_updated",
        summary=f"Bulk edited {len(entries)} time entries",
        changes={
            "set": {
                k: str(v) if isinstance(v, uuid.UUID) else v
                for k, v in changes.items()
            },
            "count": len(entries),
            "ids": [str(i) for i in ids[:ID_CAP]],
        },
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise Conflict("Time entry conflict")
    for entry in entries:
        await db.refresh(entry)
    return entries


def _same_payload(entry: TimeEntry, item: TimeEntrySyncItem) -> bool:
    if (entry.end_time is None) != (item.end_time is None):
        return False
    if entry.end_time is not None and _aware(entry.end_time) != _aware(item.end_time):
        return False
    return (
        _aware(entry.start_time) == _aware(item.start_time)
        and entry.project_id == item.project_id
        and entry.milestone_id == item.milestone_id
        and entry.description == item.description
        and entry.is_billable == item.is_billable
    )


async def _has_overlap(
    db: AsyncSession, entry: TimeEntry, user_id: uuid.UUID, now: datetime
) -> bool:
    start = _aware(entry.start_time)
    end = _aware(entry.end_time) if entry.end_time else max(now, start)
    candidates = (
        await db.execute(
            select(TimeEntry).where(
                TimeEntry.user_id == user_id,
                TimeEntry.id != entry.id,
                TimeEntry.start_time < end,
                or_(TimeEntry.end_time.is_(None), TimeEntry.end_time > start),
            )
        )
    ).scalars()
    return any(
        overlaps(start, entry.end_time, o.start_time, o.end_time, now)
        for o in candidates
    )


async def sync_time_entries(
    db: AsyncSession, items: list[TimeEntrySyncItem], user_id: uuid.UUID
) -> list[dict]:
    """Apply a batch recorded offline. Idempotent; conflicts are reported per
    entry and never fail the batch."""
    now = _now()
    running = await get_running_entry(db, user_id)
    running_id = running.id if running else None
    projects: dict[uuid.UUID, Project | None] = {}
    seen: set[uuid.UUID] = set()
    results: list[dict] = []
    counts = {"created": 0, "updated": 0, "deleted": 0, "conflict": 0, "rejected": 0}
    touched: list[uuid.UUID] = []

    async def project_for(project_id: uuid.UUID) -> Project | None:
        if project_id not in projects:
            try:
                projects[project_id] = await get_project_by_id(db, project_id, user_id)
            except NotFound:
                projects[project_id] = None
        return projects[project_id]

    def done(item, status, reason=None, entry=None, warning=None):
        counts[status] += 1
        if status in ("created", "updated", "deleted"):
            touched.append(item.id)
        results.append(
            {
                "id": item.id,
                "status": status,
                "reason": reason,
                "warning": warning,
                "entry": TimeEntryResponse.model_validate(entry) if entry else None,
            }
        )

    for item in items:
        if item.id in seen:
            done(item, "rejected", "duplicate_id")
            continue
        seen.add(item.id)

        existing = (
            await db.execute(select(TimeEntry).where(TimeEntry.id == item.id))
        ).scalar_one_or_none()
        if existing is not None and existing.user_id != user_id:
            done(item, "conflict", "id_unavailable")
            continue

        if item.deleted:
            if existing is None:
                done(item, "deleted")
            elif existing.is_invoiced:
                done(item, "conflict", "invoiced", existing)
            else:
                if running_id == existing.id:
                    running_id = None
                await db.delete(existing)
                await db.flush()
                done(item, "deleted")
            continue

        if existing is not None and existing.is_invoiced:
            done(item, "conflict", "invoiced", existing)
            continue
        if existing is not None and _same_payload(existing, item):
            # A retry of an already-applied change: nothing to do.
            done(item, "updated", entry=existing)
            continue
        if (
            existing is not None
            and item.updated_at is not None
            and _aware(existing.updated_at) > _aware(item.updated_at)
        ):
            done(item, "conflict", "server_newer", existing)
            continue

        reason = validate_window(item.start_time, item.end_time, now)
        if reason:
            done(item, "rejected", reason)
            continue
        project = await project_for(item.project_id)
        if project is None:
            done(item, "rejected", "project_not_found")
            continue
        if item.milestone_id is not None:
            found = (
                await db.execute(
                    select(Milestone.id).where(
                        Milestone.id == item.milestone_id,
                        Milestone.project_id == project.id,
                    )
                )
            ).scalar_one_or_none()
            if found is None:
                done(item, "rejected", "milestone_not_found")
                continue
        if item.end_time is None and running_id not in (None, item.id):
            done(item, "conflict", "timer_already_running", existing)
            continue

        minutes = duration_minutes(item.start_time, item.end_time) if item.end_time else 0
        if existing is None:
            entry = TimeEntry(
                id=item.id,
                description=item.description,
                start_time=item.start_time,
                end_time=item.end_time,
                duration_minutes=minutes,
                is_billable=item.is_billable,
                hourly_rate=await _resolve_rate(db, project, user_id, None),
                project_id=project.id,
                milestone_id=item.milestone_id,
                user_id=user_id,
            )
            db.add(entry)
            status = "created"
        else:
            entry = existing
            if entry.project_id != project.id:
                entry.hourly_rate = await _resolve_rate(db, project, user_id, None)
            entry.description = item.description
            entry.start_time = item.start_time
            entry.end_time = item.end_time
            entry.duration_minutes = minutes
            entry.is_billable = item.is_billable
            entry.project_id = project.id
            entry.milestone_id = item.milestone_id
            status = "updated"

        try:
            # Savepoint: a lost race on the one-running-timer index only
            # rejects this entry, not the batch.
            async with db.begin_nested():
                await db.flush()
        except IntegrityError:
            if existing is None:
                db.expunge(entry)
            else:
                await db.refresh(entry)
            done(item, "conflict", "timer_already_running")
            continue

        if item.end_time is None:
            running_id = item.id
        elif running_id == item.id:
            running_id = None
        warning = "overlap" if await _has_overlap(db, entry, user_id, now) else None
        done(item, status, entry=entry, warning=warning)

    if touched:
        log_activity(
            db,
            user_id=user_id,
            entity_type="time_entry",
            entity_id=touched[0],
            action="synced",
            summary=f"Synced {len(touched)} time entries",
            changes={**counts, "ids": [str(i) for i in touched[:ID_CAP]]},
        )
    await db.commit()
    return results
