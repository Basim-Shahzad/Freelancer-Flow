from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.utils.crud.time_entries import create_time_entry, get_time_entries
from app.utils.crud.projects import get_project_by_id
from app.schemas.TimeEntrySchema import (
    TimeEntryCreate,
    TimeEntryList,
    TimeEntryResponse,
)
from app.utils.dependencies.auth import get_current_user
from app.models.User import User

router = APIRouter(prefix="/time-entries", tags=["Time Entries"])


@router.get("/{project_id}", response_model=TimeEntryList)
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


@router.post("", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_new_time_entry(
    data: TimeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_time_entry(db=db, data=data, project_id=data.project_id)
