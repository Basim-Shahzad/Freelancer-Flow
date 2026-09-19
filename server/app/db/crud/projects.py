from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.clients import get_client_by_id
from app.models.Project import Project, ProjectStatus
from app.schemas.ProjectsSchema import ProjectCreate, ProjectUpdate


async def get_project_by_id(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Project:
    """Load a project owned by ``user_id`` (404 otherwise, never 403, so
    project ids of other users cannot be probed)."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.created_by == user_id)
        .options(selectinload(Project.client))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found",
        )
    return project


async def get_projects(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    client_id: Optional[uuid.UUID] = None,
    status: Optional[ProjectStatus] = None,
    search: Optional[str] = None,
) -> tuple[list[Project], int]:
    query = (
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.created_by == user_id)
    )

    if client_id:
        query = query.where(Project.client_id == client_id)

    if status:
        query = query.where(Project.status == status)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            Project.name.ilike(search_filter) | Project.description.ilike(search_filter)
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Project.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    projects = result.scalars().all()

    return list(projects), total


async def create_project(
    db: AsyncSession,
    data: ProjectCreate,
    user_id: uuid.UUID,
) -> Project:
    # Ownership check: the client must belong to the caller (404 otherwise).
    client = await get_client_by_id(db, data.client_id, user_id)

    values = data.model_dump()
    if values["currency"] is None:
        values["currency"] = client.currency  # may still be None: falls back later
    project = Project(**values, created_by=user_id)
    db.add(project)
    await db.flush()
    log_activity(
        db,
        user_id=user_id,
        entity_type="project",
        entity_id=project.id,
        action="created",
        summary=f"Created project {project.name}",
    )
    await db.commit()
    return await get_project_by_id(db, project.id, user_id)


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_id: uuid.UUID,
) -> Project:
    project = await get_project_by_id(db, project_id, user_id)

    update_data = data.model_dump(exclude_unset=True)
    for required in ("name", "status", "budget_type", "client_id"):
        if required in update_data and update_data[required] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{required} cannot be null",
            )
    if update_data.get("client_id") not in (None, project.client_id):
        await get_client_by_id(db, update_data["client_id"], user_id)

    changes = diff_changes(project, update_data)
    for field, value in update_data.items():
        setattr(project, field, value)
    if changes:
        log_activity(
            db,
            user_id=user_id,
            entity_type="project",
            entity_id=project.id,
            action="updated",
            summary=f"Updated project {project.name}",
            changes=changes,
        )

    await db.commit()
    return await _reload(db, project.id, user_id)


async def _reload(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Fresh read so relationships/derived columns reflect the commit."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.created_by == user_id)
        .options(selectinload(Project.client))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def delete_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    project = await get_project_by_id(db, project_id, user_id)
    name = project.name
    await db.delete(project)
    log_activity(
        db,
        user_id=user_id,
        entity_type="project",
        entity_id=project_id,
        action="deleted",
        summary=f"Deleted project {name}",
    )
    try:
        await db.commit()
    except IntegrityError:
        # Invoices reference projects with ON DELETE RESTRICT.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project has invoices and cannot be deleted; archive it instead",
        )
