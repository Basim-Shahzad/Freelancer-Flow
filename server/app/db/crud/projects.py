from __future__ import annotations

import uuid
from datetime import date
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, Forbidden, NotFound, Unprocessable
from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.clients import get_client_by_id
from app.db.crud.freelancers import get_freelancer_by_user
from app.models.Project import BillingType, Project, ProjectStatus
from app.schemas.ProjectsSchema import ProjectCreate, ProjectUpdate


async def get_project_by_id(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Project:
    """Load a project owned by ``user_id`` (404 otherwise, never 403, so
    project ids of other users cannot be probed)."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.created_by == user_id)
        .options(selectinload(Project.client))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise NotFound(f"Project with id {project_id} not found")
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


_RETAINER_FIELDS = ("retainer_amount", "retainer_interval", "retainer_start_date")


async def _billing_adjustments(
    db: AsyncSession,
    user_id: uuid.UUID,
    state: dict[str, Any],
    supplied: dict[str, Any],
    existing_milestones: int = 0,
) -> dict[str, Any]:
    """Validate the merged billing state and return derived field changes.

    ``state`` is the project as it will be after the write; ``supplied`` is
    only what the caller sent (so retainer fields on a non-retainer project
    are rejected when sent, but cleared when merely left over from a switch).
    """
    billing_type = state["billing_type"]
    out: dict[str, Any] = {}

    if billing_type == BillingType.RETAINER:
        if state.get("retainer_amount") is None or state.get("retainer_interval") is None:
            raise Unprocessable("RETAINER projects require retainer_amount and retainer_interval")
        if state.get("retainer_start_date") is None:
            out["retainer_start_date"] = date.today()
    else:
        if any(supplied.get(f) is not None for f in _RETAINER_FIELDS):
            raise Unprocessable("Retainer fields are only valid for RETAINER projects")
        for f in _RETAINER_FIELDS:
            if state.get(f) is not None:
                out[f] = None

    if billing_type == BillingType.MILESTONE:
        if supplied.get("milestones_enabled") is False:
            raise Unprocessable("MILESTONE projects always have milestones enabled")
        out["milestones_enabled"] = True
    elif state.get("milestones_enabled") is False and existing_milestones > 0:
        raise Conflict("Project has milestones; delete them before disabling milestones")

    if billing_type == BillingType.HOURLY and state.get("hourly_rate") is None:
        try:
            freelancer = await get_freelancer_by_user(db, user_id)
        except Forbidden:
            freelancer = None
        if freelancer is not None and freelancer.hourly_rate is not None:
            out["hourly_rate"] = freelancer.hourly_rate
    return out


async def create_project(
    db: AsyncSession,
    data: ProjectCreate,
    user_id: uuid.UUID,
) -> Project:
    # Ownership check: the client must belong to the caller (404 otherwise).
    client = await get_client_by_id(db, data.client_id, user_id)

    values = data.model_dump()
    values.update(
        await _billing_adjustments(
            db, user_id, values, data.model_dump(exclude_unset=True)
        )
    )
    if values["currency"] is None:
        values["currency"] = client.currency  # may still be None: falls back later
    project = Project(**values, created_by=user_id)
    db.add(project)
    await db.flush()
    log_activity(
        db,
        user_id=user_id,
        entity_type="project",
        entity_id=project.id,
        action="created",
        summary=f"Created project {project.name}",
    )
    await db.commit()
    return await get_project_by_id(db, project.id, user_id)


async def update_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: ProjectUpdate,
    user_id: uuid.UUID,
) -> Project:
    project = await get_project_by_id(db, project_id, user_id)

    update_data = data.model_dump(exclude_unset=True)
    for required in ("name", "status", "billing_type", "client_id"):
        if required in update_data and update_data[required] is None:
            raise Unprocessable(f"{required} cannot be null")
    if update_data.get("client_id") not in (None, project.client_id):
        await get_client_by_id(db, update_data["client_id"], user_id)

    state = {
        f: getattr(project, f)
        for f in (
            "billing_type",
            "milestones_enabled",
            "hourly_rate",
            *_RETAINER_FIELDS,
        )
    }
    state.update(update_data)
    if state["milestones_enabled"] is None:
        raise Unprocessable("milestones_enabled cannot be null")
    update_data.update(
        await _billing_adjustments(
            db, user_id, state, update_data, existing_milestones=project.milestone_total
        )
    )

    changes = diff_changes(project, update_data)
    for field, value in update_data.items():
        setattr(project, field, value)
    if changes:
        log_activity(
            db,
            user_id=user_id,
            entity_type="project",
            entity_id=project.id,
            action="updated",
            summary=f"Updated project {project.name}",
            changes=changes,
        )

    await db.commit()
    return await _reload(db, project.id, user_id)


async def _reload(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Fresh read so relationships/derived columns reflect the commit."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.created_by == user_id)
        .options(selectinload(Project.client))
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def delete_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    project = await get_project_by_id(db, project_id, user_id)
    name = project.name
    await db.delete(project)
    log_activity(
        db,
        user_id=user_id,
        entity_type="project",
        entity_id=project_id,
        action="deleted",
        summary=f"Deleted project {name}",
    )
    try:
        await db.commit()
    except IntegrityError:
        # Invoices reference projects with ON DELETE RESTRICT.
        await db.rollback()
        raise Conflict("Project has invoices and cannot be deleted; archive it instead")
