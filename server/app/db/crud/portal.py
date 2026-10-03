from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.crud.activity import log_activity
from app.models.ClientProfile import ClientProfile
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.MilestoneApproval import MilestoneApproval, MilestoneApprovalDecision
from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.Project import Project
from app.models.User import User


def require_scope(
    token: PortalAccessToken, scope_type: ScopeType, scope_id: uuid.UUID
) -> None:
    """Confirms the token was issued for this exact resource, not just for
    this client in general. Without this, a token scoped to Project A would
    also work against Project B for the same client."""
    if token.scope_type != scope_type or token.scope != scope_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Token is not valid for this {scope_type.value.lower()}",
        )


async def get_portal_project(
    db: AsyncSession, project_id: uuid.UUID, client: ClientProfile, token: PortalAccessToken
) -> Project:
    require_scope(token, ScopeType.PROJECT, project_id)
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.client_id == client.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


async def get_portal_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    client: ClientProfile,
    token: PortalAccessToken,
    *,
    for_update: bool = False,
) -> Milestone:
    query = select(Milestone).where(
        Milestone.id == milestone_id,
        Milestone.project.has(Project.client_id == client.id),
    )
    if for_update:
        query = query.with_for_update()
    milestone = (await db.execute(query)).scalar_one_or_none()
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    # token is scoped by project, so check the milestone's project matches it
    require_scope(token, ScopeType.PROJECT, milestone.project_id)
    return milestone


async def decide_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    decision: MilestoneApprovalDecision,
    client: ClientProfile,
    token: PortalAccessToken,
    *,
    comment: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Milestone:
    comment = comment.strip() if comment else None
    if decision == MilestoneApprovalDecision.REJECTED and not comment:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A comment explaining the rejection is required",
        )
    # Lock the row for the duration of this transaction so two near-
    # simultaneous approve/reject calls can't both pass the status check.
    milestone = await get_portal_milestone(
        db, milestone_id, client, token, for_update=True
    )

    if milestone.status != MilestoneStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Milestone cannot be {decision.value.lower()}ed because it is in status {milestone.status.value}",
        )

    db.add(
        MilestoneApproval(
            milestone_id=milestone.id,
            client_id=client.id,
            decision=decision,
            comment=comment,
            ip_address=ip_address,
            user_agent=user_agent,
            access_token_id=token.id,
        )
    )

    milestone.status = (
        MilestoneStatus.APPROVED
        if decision == MilestoneApprovalDecision.APPROVED
        else MilestoneStatus.REJECTED
    )
    # Denormalised cache of the latest decision (the approval row above is
    # the audit history).
    milestone.approved_by_client_id = client.id
    milestone.approved_at = datetime.now(timezone.utc)

    project = await db.get(Project, milestone.project_id)
    if project is not None:
        log_activity(
            db,
            user_id=project.created_by,
            entity_type="milestone",
            entity_id=milestone.id,
            action=decision.value.lower(),
            summary=f"{client.name} {decision.value.lower()} milestone "
            f"{milestone.name}",
            changes={"comment": comment} if comment else None,
        )

    await db.commit()
    await db.refresh(milestone)
    return milestone


async def convert_client_to_user(
    db: AsyncSession, client: ClientProfile, password: str
) -> ClientProfile:
    """Give a guest portal client a real login."""
    if client.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This client already has an account",
        )

    result = await db.execute(select(User).where(User.email == client.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_user = User(
        email=client.email,
        hashed_password=hash_password(password),
        full_name=client.name,
        is_verified=True,  # email ownership already proven via the portal token
    )
    db.add(new_user)
    await db.flush()  # get new_user.id without a full commit yet

    client.user_id = new_user.id
    await db.commit()
    await db.refresh(client)
    return client
