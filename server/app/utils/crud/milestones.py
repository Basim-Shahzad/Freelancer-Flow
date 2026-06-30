from __future__ import annotations

import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.MilestoneSchema import MilestoneCreate, MilestoneResponse
from app.models.Milestone import Milestone
from sqlalchemy import func, select

async def get_milestones(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> tuple[list[Milestone], int]:
    query = (
        select(Milestone)
        .where(Milestone.project_id == project_id)
    )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Milestone.created_at.desc())
    result = await db.execute(query)
    milestones = result.scalars().all()

    # Clean, beautiful, and automatic:
    return list(milestones), total


async def create_milestone(
    db: AsyncSession, data: MilestoneCreate, project_id: uuid.UUID
) -> MilestoneResponse:
    data_dict = data.model_dump(exclude={"project_id"})

    milestone = Milestone(**data_dict, project_id=project_id)
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)
    
    return MilestoneResponse.model_validate(milestone)