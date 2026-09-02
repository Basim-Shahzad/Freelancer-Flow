from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import TypeAdapter

from app.db.database import get_db
from app.db.crud.projects import (
    get_project_by_id,
    get_projects,
    create_project,
    update_project,
    delete_project,
)
from app.db.crud.milestones import get_milestones
from app.schemas.ProjectsSchema import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
)
from app.schemas.MilestoneSchema import MilestoneListResponse, MilestoneResponse
from app.models.Project import ProjectStatus
from app.api.dependencies.auth import get_current_user
from app.models.User import User
from app.models.Project import Project

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    client_id: Optional[uuid.UUID] = Query(None),
    status: Optional[ProjectStatus] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects, total = await get_projects(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        client_id=client_id,
        status=status,
        search=search,
    )
    return ProjectListResponse(projects=projects, total=total)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project_by_id(
        db=db, project_id=project_id, user_id=current_user.id
    )
    return project



@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_new_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await create_project(db=db, data=data, user_id=current_user.id)
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_existing_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await update_project(
        db=db,
        project_id=project_id,
        data=data,
        user_id=current_user.id,
    )
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_project(db=db, project_id=project_id, user_id=current_user.id)

@router.get("/{project_id}/milestones/", response_model=MilestoneListResponse)
async def list_milestones(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    if current_user.freelancer is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only freelancers can view project milestones",
        )
 
    project_result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.client.has(freelancer_id=current_user.freelancer.id),
        )
    )
    project = project_result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
 
    milestone_list_adapter = TypeAdapter(list[MilestoneResponse])
    milestones, total = await get_milestones(
        db=db,
        project_id=project_id,
    )
    validated_milestones = milestone_list_adapter.validate_python(milestones)
 
    return MilestoneListResponse(milestones=validated_milestones, total=total)
 