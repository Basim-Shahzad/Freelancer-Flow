from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from server.app.db.crud.milestones import (
    get_milestones,
    create_milestone,
    update_milestone_status
)
from app.schemas.MilestoneSchema import (
    MilestoneListResponse,
    MilestoneResponse,
    MilestoneCreate
)
from app.models.Milestone import MilestoneStatus
from app.models.Project import Project
from server.app.api.dependencies.auth import get_current_user
from app.models.User import User

router = APIRouter(prefix="/milestones", tags=["Milestones"])

@router.post("", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_new_milestone(
    data: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    milestone = await create_milestone(data=data, db=db)
    return milestone


@router.get("/{milestone_id}/submit", response_model=MilestoneResponse)
async def update_milestone_statuses(
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ownership check: confirm this project belongs to the calling
    # freelancer before letting them submit a milestone under it. Without
    # this, any authenticated user could submit milestones on any project
    # by guessing/enumerating IDs.
    if current_user.freelancer is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only freelancers can submit milestones",
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
 
    milestone = await update_milestone_status(db, MilestoneStatus.SUBMITTED, milestone_id)
 
    # Defense-in-depth: confirm the milestone actually belongs to the
    # project_id passed in, not just that both IDs independently exist.
    if milestone.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone does not belong to the given project",
        )
 
    return milestone