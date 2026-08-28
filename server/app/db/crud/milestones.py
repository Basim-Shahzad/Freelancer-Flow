from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.MilestoneSchema import (
    MilestoneCreate,
    MilestoneResponse,
    MilestoneStatus,
)
from app.models.Milestone import Milestone
from sqlalchemy import func, select

from app.models.Project import Project
from app.models.PortalAccessToken import ScopeType
from app.utils.dependencies.client_portal import issue_portal_token
from app.services.email_service import send_portal_approval_email


async def get_milestones(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> tuple[list[Milestone], int]:
    query = select(Milestone).where(Milestone.project_id == project_id)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Milestone.created_at.desc())
    result = await db.execute(query)
    milestones = result.scalars().all()

    # Clean, beautiful, and automatic:
    return list(milestones), total


async def create_milestone(
    db: AsyncSession, data: MilestoneCreate) -> MilestoneResponse:
    milestone = Milestone(**data.model_dump())
    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)

    return MilestoneResponse.model_validate(milestone)


async def get_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
) -> MilestoneResponse:
    query = select(Milestone).where(Milestone.id == milestone_id)
    result = await db.execute(query)
    milestone = result.scalars().first()
    return MilestoneResponse.model_validate(milestone)


async def update_milestone_status(
    db: AsyncSession, data: MilestoneStatus, milestone_id: uuid.UUID
) -> Milestone:
    query = select(Milestone).where(Milestone.id == milestone_id)
    result = await db.execute(query)
    milestone = result.scalars().first()
 
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
 
    # Guard: only allow submission from a pre-submission state. Without this,
    # an already-approved or already-rejected milestone could be silently
    # flipped back to SUBMITTED and re-enter the approval flow.
    if data == MilestoneStatus.SUBMITTED and milestone.status != MilestoneStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit milestone in status {milestone.status.value}",
        )
 
    milestone.status = data
    await db.commit()
    await db.refresh(milestone)
 
    # Only fire the portal-token / email flow when this is an actual submit,
    # not for other status transitions that might route through this same
    # function in the future.
    if data == MilestoneStatus.SUBMITTED:
        project_result = await db.execute(
            select(Project).where(Project.id == milestone.project_id)
        )
        project = project_result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found for this milestone",
            )
 
        token = await issue_portal_token(
            db,
            client_id=project.client_id,
            scope_type=ScopeType.PROJECT,
            scope_id=project.id,
        )
 
        # Adjust this call to match your real email-sending signature/service.
        await send_portal_approval_email(
            to_client_id=project.client_id,
            project_id=project.id,
            milestone_id=milestone.id,
            portal_token=token,
        )
 
    return milestone
