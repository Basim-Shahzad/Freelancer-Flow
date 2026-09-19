from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.client_portal import issue_portal_token
from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.projects import get_project_by_id
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.PortalAccessToken import ScopeType
from app.models.Project import Project
from app.schemas.MilestoneSchema import MilestoneCreate, MilestoneUpdate
from app.services.email_service import send_portal_approval_email

# Statuses a freelancer may move a milestone to by hand. SUBMITTED goes through
# submit_milestone(); a client's APPROVED / REJECTED comes from the portal.
_MANUAL_TRANSITIONS: dict[MilestoneStatus, set[MilestoneStatus]] = {
    MilestoneStatus.PENDING: {MilestoneStatus.IN_PROGRESS},
    MilestoneStatus.IN_PROGRESS: {MilestoneStatus.PENDING, MilestoneStatus.APPROVED},
    MilestoneStatus.SUBMITTED: {MilestoneStatus.IN_PROGRESS},  # withdraw
    MilestoneStatus.APPROVED: set(),
    MilestoneStatus.REJECTED: {MilestoneStatus.IN_PROGRESS},  # rework
}
_SUBMITTABLE = {
    MilestoneStatus.PENDING,
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.REJECTED,
}


async def get_owned_milestone(
    db: AsyncSession, milestone_id: uuid.UUID, user_id: uuid.UUID
) -> Milestone:
    """404 unless the milestone's project belongs to ``user_id``."""
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.project.has(Project.created_by == user_id),
        )
    )
    milestone = result.scalar_one_or_none()
    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    return milestone


async def get_milestones(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> tuple[list[Milestone], int]:
    result = await db.execute(
        select(Milestone)
        .where(Milestone.project_id == project_id)
        .order_by(Milestone.sort_order, Milestone.created_at)
    )
    milestones = list(result.scalars().all())
    return milestones, len(milestones)


async def create_milestone(
    db: AsyncSession, data: MilestoneCreate, user_id: uuid.UUID
) -> Milestone:
    project = await get_project_by_id(db, data.project_id, user_id)

    next_order = (
        await db.execute(
            select(func.coalesce(func.max(Milestone.sort_order), -1) + 1).where(
                Milestone.project_id == project.id
            )
        )
    ).scalar_one()

    milestone = Milestone(**data.model_dump(), sort_order=next_order)
    db.add(milestone)
    await db.flush()
    log_activity(
        db,
        user_id=user_id,
        entity_type="milestone",
        entity_id=milestone.id,
        action="created",
        summary=f"Added milestone {milestone.name} to {project.name}",
    )
    await db.commit()
    await db.refresh(milestone)
    return milestone


async def update_milestone(
    db: AsyncSession, milestone_id: uuid.UUID, data: MilestoneUpdate, user_id: uuid.UUID
) -> Milestone:
    milestone = await get_owned_milestone(db, milestone_id, user_id)
    update_data = data.model_dump(exclude_unset=True)
    for required in ("name", "status", "approval_required", "sort_order"):
        if required in update_data and update_data[required] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{required} cannot be null",
            )

    new_status = update_data.get("status")
    if new_status is not None and new_status != milestone.status:
        approval_required = update_data.get("approval_required", milestone.approval_required)
        allowed = _MANUAL_TRANSITIONS[milestone.status]
        if new_status not in allowed or (
            new_status == MilestoneStatus.APPROVED and approval_required
        ):
            hint = (
                " (use the submit endpoint to request client approval)"
                if new_status == MilestoneStatus.SUBMITTED
                or new_status == MilestoneStatus.APPROVED
                else ""
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot move milestone from {milestone.status.value} "
                f"to {new_status.value}{hint}",
            )
        if new_status == MilestoneStatus.APPROVED:
            milestone.approved_at = datetime.now(timezone.utc)
            milestone.approved_by_client_id = None
    elif "status" in update_data:
        update_data.pop("status")

    changes = diff_changes(milestone, update_data)
    for field, value in update_data.items():
        setattr(milestone, field, value)
    if changes:
        log_activity(
            db,
            user_id=user_id,
            entity_type="milestone",
            entity_id=milestone.id,
            action="updated",
            summary=f"Updated milestone {milestone.name}",
            changes=changes,
        )
    await db.commit()
    await db.refresh(milestone)
    return milestone


async def reorder_milestones(
    db: AsyncSession,
    project_id: uuid.UUID,
    milestone_ids: list[uuid.UUID],
    user_id: uuid.UUID,
) -> list[Milestone]:
    project = await get_project_by_id(db, project_id, user_id)
    milestones, _ = await get_milestones(db, project.id)
    existing = {m.id: m for m in milestones}
    if len(set(milestone_ids)) != len(milestone_ids) or set(milestone_ids) != set(existing):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="milestoneIds must list every milestone of the project exactly once",
        )
    for position, mid in enumerate(milestone_ids):
        existing[mid].sort_order = position
    log_activity(
        db,
        user_id=user_id,
        entity_type="project",
        entity_id=project.id,
        action="milestones_reordered",
        summary=f"Reordered milestones of {project.name}",
    )
    await db.commit()
    return [existing[mid] for mid in milestone_ids]


async def delete_milestone(
    db: AsyncSession, milestone_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    milestone = await get_owned_milestone(db, milestone_id, user_id)
    billed = (
        await db.execute(
            select(func.count(InvoiceItem.id))
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(
                InvoiceItem.milestone_id == milestone.id,
                Invoice.status != InvoiceStatus.CANCELLED,
            )
        )
    ).scalar_one()
    if billed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Milestone has been invoiced and cannot be deleted",
        )
    log_activity(
        db,
        user_id=user_id,
        entity_type="milestone",
        entity_id=milestone.id,
        action="deleted",
        summary=f"Deleted milestone {milestone.name}",
    )
    await db.delete(milestone)
    await db.commit()


async def submit_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> Milestone:
    """Submit a milestone for client approval and email the client a portal link.

    If ``project_id`` is given it must match the milestone's project; the
    check happens *before* any mutation.
    """
    milestone = await get_owned_milestone(db, milestone_id, user_id)
    if project_id is not None and milestone.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone does not belong to the given project",
        )
    if milestone.status not in _SUBMITTABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit milestone in status {milestone.status.value}",
        )

    project = await get_project_by_id(db, milestone.project_id, user_id)

    milestone.status = MilestoneStatus.SUBMITTED
    milestone.submitted_at = datetime.now(timezone.utc)
    # A fresh decision cycle: clear any previous verdict.
    milestone.approved_at = None
    milestone.approved_by_client_id = None

    token = await issue_portal_token(
        db,
        client_id=project.client_id,
        scope_type=ScopeType.PROJECT,
        scope_id=project.id,
        commit=False,
    )
    log_activity(
        db,
        user_id=user_id,
        entity_type="milestone",
        entity_id=milestone.id,
        action="submitted",
        summary=f"Submitted milestone {milestone.name} for approval",
    )
    await db.commit()
    await db.refresh(milestone)

    await send_portal_approval_email(
        to_client_id=project.client_id,
        project_id=project.id,
        milestone_id=milestone.id,
        portal_token=token,
    )
    return milestone
