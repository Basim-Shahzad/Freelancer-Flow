from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_freelancer, get_current_user
from app.api.v1.openapi import errors
from app.db.crud.milestones import (
    create_milestone,
    delete_milestone,
    get_owned_milestone,
    submit_milestone,
    update_milestone,
)
from app.db.database import get_db
from app.models.User import User
from app.schemas.MilestoneSchema import (
    MilestoneCreate,
    MilestoneResponse,
    MilestoneUpdate,
)

router = APIRouter(prefix="/milestones", tags=["Milestones"])


@router.post(
    "",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a milestone",
    description="Appended to the end of the project's milestone order. "
    "`amount` is the money the milestone bills for fixed-price work.",
    responses=errors(401, 404),
)
async def create_new_milestone(
    data: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_milestone(db=db, data=data, user_id=current_user.id)


@router.get(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Get a milestone",
    responses=errors(401, 404),
)
async def get_milestone(
    milestone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_owned_milestone(db, milestone_id, current_user.id)


@router.patch(
    "/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update a milestone",
    description="Status changes follow a transition matrix: PENDING -> IN_PROGRESS, "
    "IN_PROGRESS -> PENDING / APPROVED (only when approval is not required), "
    "SUBMITTED -> IN_PROGRESS (withdraw), REJECTED -> IN_PROGRESS (rework). "
    "Use `POST /milestones/{id}/submit` to request client approval.",
    responses=errors(401, 404, 409, 422),
)
async def update_existing_milestone(
    milestone_id: uuid.UUID,
    data: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await update_milestone(
        db=db, milestone_id=milestone_id, data=data, user_id=current_user.id
    )


@router.delete(
    "/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a milestone",
    description="Tracked time attached to the milestone is kept (detached). "
    "Invoiced milestones cannot be deleted.",
    responses=errors(401, 404, 409),
)
async def delete_existing_milestone(
    milestone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_milestone(db=db, milestone_id=milestone_id, user_id=current_user.id)


@router.post(
    "/{milestone_id}/submit",
    response_model=MilestoneResponse,
    summary="Submit a milestone for client approval",
    description="Moves PENDING / IN_PROGRESS / REJECTED milestones to SUBMITTED, "
    "stamps `submittedAt` and emails the client a project-scoped portal link.",
    responses=errors(401, 403, 404, 409),
)
async def submit_milestone_for_approval(
    milestone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _freelancer=Depends(get_current_freelancer),
):
    return await submit_milestone(db, milestone_id, current_user.id)


@router.get(
    "/{milestone_id}/submit",
    response_model=MilestoneResponse,
    deprecated=True,
    summary="Submit a milestone (deprecated GET form)",
    description="Deprecated: a state-changing GET can be triggered by link "
    "prefetchers and cross-site requests. Use `POST /milestones/{id}/submit`.",
    responses=errors(401, 403, 404, 409),
)
async def submit_milestone_legacy_get(
    milestone_id: uuid.UUID,
    project_id: uuid.UUID = Query(..., description="Must match the milestone's project."),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _freelancer=Depends(get_current_freelancer),
):
    return await submit_milestone(db, milestone_id, current_user.id, project_id)
