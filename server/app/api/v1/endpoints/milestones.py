from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.utils.crud.milestones import (
    get_milestones,
    create_milestone
)
from app.schemas.MilestoneSchema import (
    MilestoneListResponse,
    MilestoneResponse,
    MilestoneCreate
)
from pydantic import TypeAdapter
from app.utils.dependencies.auth import get_current_user
from app.models.User import User

router = APIRouter(prefix="/milestones", tags=["Milestones"])


@router.get("", response_model=MilestoneListResponse)
async def list_milestones(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    
    milestone_list_adapter = TypeAdapter(list[MilestoneResponse])
    milestones, total = await get_milestones(
        db=db,
        project_id=project_id,
    )
    validated_milestones = milestone_list_adapter.validate_python(milestones)

    return MilestoneListResponse(milestones=validated_milestones, total=total)

@router.post("", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
async def create_new_milestone(
    data: MilestoneCreate,
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    milestone = await create_milestone(data=data, project_id=project_id, db=db)
    return milestone
