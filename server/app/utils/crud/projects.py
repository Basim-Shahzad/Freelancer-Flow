from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.Project import Project, ProjectStatus
from app.schemas.ProjectsSchema import ProjectCreate, ProjectUpdate


async def get_project_by_id(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Project:
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
    project = Project(**data.model_dump(), created_by=user_id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_id: uuid.UUID,
) -> Project:
    project = await get_project_by_id(db, project_id, user_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    project = await get_project_by_id(db, project_id, user_id)
    await db.delete(project)
    await db.commit()
