from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.v1.openapi import errors
from app.db.crud.projects import get_project_by_id
from app.db.crud.time_entries import (
    create_time_entry,
    delete_time_entry,
    get_running_entry,
    get_time_entries,
    start_timer,
    stop_timer,
    update_time_entry,
)
from app.db.database import get_db
from app.models.User import User
from app.schemas.TimeEntrySchema import (
    TimeEntryCreate,
    TimeEntryList,
    TimeEntryResponse,
    TimeEntryStart,
    TimeEntryUpdate,
)

router = APIRouter(prefix="/time-entries", tags=["Time Entries"])


@router.get(
    "/running",
    response_model=TimeEntryResponse | None,
    summary="Get the running timer",
    description="Returns the caller's running timer (an entry with no end time), "
    "or `null` when none is running.",
    responses=errors(401),
)
async def get_running_timer(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_running_entry(db, current_user.id)


@router.post(
    "/start",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a timer",
    description="Starts a running timer on a project. A user can have only one "
    "running timer at a time. The hourly rate is snapshotted from the request, "
    "then the project, then the freelancer profile.",
    responses=errors(401, 404, 409, 422),
)
async def start_time_entry_timer(
    data: TimeEntryStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await start_timer(db=db, data=data, user_id=current_user.id)


@router.post(
    "/entry/{entry_id}/stop",
    response_model=TimeEntryResponse,
    summary="Stop a running timer",
    responses=errors(401, 404, 409),
)
async def stop_time_entry_timer(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await stop_timer(db=db, entry_id=entry_id, user_id=current_user.id)


@router.get(
    "/{project_id}",
    response_model=TimeEntryList,
    summary="List a project's time entries",
    responses=errors(401, 404),
)
async def list_time_entries(
    project_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project_by_id(
        db=db, project_id=project_id, user_id=current_user.id
    )

    time_entries, total = await get_time_entries(
        db=db,
        skip=skip,
        limit=limit,
        project_id=project.id,
    )
    return TimeEntryList(time_entries=time_entries, total=total)


@router.post(
    "",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a completed time entry",
    description="`durationMinutes` is derived from the start and end times.",
    responses=errors(401, 404, 422),
)
async def create_new_time_entry(
    data: TimeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_time_entry(db=db, data=data, user_id=current_user.id)


@router.patch(
    "/entry/{entry_id}",
    response_model=TimeEntryResponse,
    summary="Edit a time entry",
    description="Invoiced entries are immutable. Setting `endTime` on a running "
    "entry stops it.",
    responses=errors(401, 404, 409, 422),
)
async def update_existing_time_entry(
    entry_id: uuid.UUID,
    data: TimeEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await update_time_entry(
        db=db, entry_id=entry_id, data=data, user_id=current_user.id
    )


@router.delete(
    "/entry/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a time entry",
    responses=errors(401, 404, 409),
)
async def delete_existing_time_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_time_entry(db=db, entry_id=entry_id, user_id=current_user.id)
