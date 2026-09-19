from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_freelancer, get_current_user
from app.api.v1.openapi import errors
from app.db.crud.milestones import get_milestones, reorder_milestones
from app.db.crud.projects import (
    create_project,
    delete_project,
    get_project_by_id,
    get_projects,
    update_project,
)
from app.db.database import get_db
from app.models.Project import ProjectStatus
from app.models.User import User
from app.schemas.MilestoneSchema import (
    MilestoneListResponse,
    MilestoneReorder,
)
from app.schemas.ProjectsSchema import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get(
    "",
    response_model=ProjectListResponse,
    summary="List projects",
    responses=errors(401),
)
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    client_id: Optional[uuid.UUID] = Query(None),
    status: Optional[ProjectStatus] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
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


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get a project",
    responses=errors(401, 404),
)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_project_by_id(db=db, project_id=project_id, user_id=current_user.id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project",
    description="The client must belong to the caller. `hourlyRate` snapshots the "
    "rate for hourly billing; time entries fall back to the profile rate when unset.",
    responses=errors(401, 404),
)
async def create_new_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_project(db=db, data=data, user_id=current_user.id)


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project",
    responses=errors(401, 404, 422),
)
async def update_existing_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await update_project(
        db=db,
        project_id=project_id,
        data=data,
        user_id=current_user.id,
    )


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project",
    description="Projects that have invoices cannot be deleted; archive them.",
    responses=errors(401, 404, 409),
)
async def delete_existing_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_project(db=db, project_id=project_id, user_id=current_user.id)


@router.get(
    "/{project_id}/milestones/",
    response_model=MilestoneListResponse,
    summary="List a project's milestones",
    description="Ordered by `sortOrder`.",
    responses=errors(401, 403, 404),
)
async def list_milestones(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _freelancer=Depends(get_current_freelancer),
):
    project = await get_project_by_id(db, project_id, current_user.id)
    milestones, total = await get_milestones(db=db, project_id=project.id)
    return MilestoneListResponse(milestones=milestones, total=total)


@router.put(
    "/{project_id}/milestones/order",
    response_model=MilestoneListResponse,
    summary="Reorder a project's milestones",
    description="Send every milestone id of the project exactly once, in the "
    "desired order.",
    responses=errors(401, 404, 422),
)
async def reorder_project_milestones(
    project_id: uuid.UUID,
    data: MilestoneReorder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    milestones = await reorder_milestones(
        db, project_id, data.milestone_ids, current_user.id
    )
    return MilestoneListResponse(milestones=milestones, total=len(milestones))
