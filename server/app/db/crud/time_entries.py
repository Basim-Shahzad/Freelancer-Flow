from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.TimeEntry import TimeEntry
from app.schemas.TimeEntrySchema import TimeEntryCreate


from sqlalchemy import func, select


async def get_time_entries(
    db: AsyncSession,
    project_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[TimeEntry], int]:
    filters = [TimeEntry.project_id == project_id]

    count_query = select(func.count(TimeEntry.id)).where(*filters)
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    data_query = (
        select(TimeEntry)
        .where(*filters)
        .order_by(TimeEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(data_query)
    time_entries = result.scalars().all()

    return list(time_entries), total


async def create_time_entry(
    db: AsyncSession, data: TimeEntryCreate, project_id: uuid.UUID
) -> TimeEntry:
    data_dict = data.model_dump(exclude={"project_id"})

    time_entry = TimeEntry(**data_dict, project_id=project_id)
    db.add(time_entry)
    await db.commit()
    await db.refresh(time_entry)
    return time_entry
