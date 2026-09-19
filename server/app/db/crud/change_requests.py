from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.projects import get_project_by_id
from app.models.ChangeRequest import ChangeRequest, ChangeRequestStatus
from app.models.Project import Project
from app.schemas.ChangeRequestSchema import ChangeRequestCreate, ChangeRequestUpdate



async def get_change_request_by_id(
    db: AsyncSession, change_request_id: uuid.UUID, user_id: uuid.UUID
) -> ChangeRequest:
    result = await db.execute(
        select(ChangeRequest).where(
            ChangeRequest.id == change_request_id,
            ChangeRequest.project.has(Project.created_by == user_id),
        )
    )
    change_request = result.scalar_one_or_none()
    if change_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Change request not found"
        )
    return change_request


async def get_change_requests(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    project_id: Optional[uuid.UUID] = None,
    status_filter: Optional[ChangeRequestStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[ChangeRequest], int]:
    filters = [ChangeRequest.project.has(Project.created_by == user_id)]
    if project_id:
        filters.append(ChangeRequest.project_id == project_id)
    if status_filter:
        filters.append(ChangeRequest.status == status_filter)

    total = (
        await db.execute(select(func.count(ChangeRequest.id)).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(ChangeRequest)
            .where(*filters)
            .order_by(ChangeRequest.requested_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total


async def create_change_request(
    db: AsyncSession, data: ChangeRequestCreate, user_id: uuid.UUID
) -> ChangeRequest:
    project = await get_project_by_id(db, data.project_id, user_id)
    change_request = ChangeRequest(**data.model_dump())
    db.add(change_request)
    await db.flush()
    log_activity(
        db,
        user_id=user_id,
        entity_type="change_request",
        entity_id=change_request.id,
        action="created",
        summary=f"Change request '{change_request.title}' on {project.name}",
    )
    await db.commit()
    await db.refresh(change_request)
    return change_request


async def update_change_request(
    db: AsyncSession,
    change_request_id: uuid.UUID,
    data: ChangeRequestUpdate,
    user_id: uuid.UUID,
) -> ChangeRequest:
    change_request = await get_change_request_by_id(db, change_request_id, user_id)
    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("title", "x") is None or update_data.get("status", "x") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="title and status cannot be null",
        )

    if change_request.status != ChangeRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Change request is already {change_request.status.value}; "
            "decisions are final",
        )

    new_status = update_data.get("status")
    if new_status == ChangeRequestStatus.PENDING:
        update_data.pop("status")
        new_status = None
    if new_status is not None:
        change_request.decided_at = datetime.now(timezone.utc)
    elif "decision_note" in update_data and update_data["decision_note"] is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="decision_note can only be set together with a decision",
        )

    changes = diff_changes(change_request, update_data)
    for field, value in update_data.items():
        setattr(change_request, field, value)
    if changes:
        action = new_status.value.lower() if new_status else "updated"
        log_activity(
            db,
            user_id=user_id,
            entity_type="change_request",
            entity_id=change_request.id,
            action=action,
            summary=f"Change request '{change_request.title}' {action}",
            changes=changes,
        )
    await db.commit()
    await db.refresh(change_request)
    return change_request


async def delete_change_request(
    db: AsyncSession, change_request_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    change_request = await get_change_request_by_id(db, change_request_id, user_id)
    log_activity(
        db,
        user_id=user_id,
        entity_type="change_request",
        entity_id=change_request.id,
        action="deleted",
        summary=f"Deleted change request '{change_request.title}'",
    )
    await db.delete(change_request)
    await db.commit()
