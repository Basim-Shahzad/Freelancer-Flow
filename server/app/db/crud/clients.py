from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.models.ClientProfile import ClientProfile
from app.models.FreelancerProfile import FreelancerProfile
from app.schemas.ClientsSchema import ClientCreate, ClientUpdate


def _owned_by(user_id: uuid.UUID):
    """Clients belong to a freelancer; ``user_id`` is the freelancer's user."""
    return ClientProfile.freelancer.has(FreelancerProfile.user_id == user_id)


async def get_client_by_id(
    db: AsyncSession,
    client_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ClientProfile:
    result = await db.execute(
        select(ClientProfile).where(ClientProfile.id == client_id, _owned_by(user_id))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    return client


async def get_clients(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
) -> tuple[list[ClientProfile], int]:
    query = (
        select(ClientProfile)
        .options(selectinload(ClientProfile.projects))
        .where(_owned_by(user_id))
    )

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            ClientProfile.name.ilike(search_filter)
            | ClientProfile.email.ilike(search_filter)
            | ClientProfile.company_name.ilike(search_filter)
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(ClientProfile.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    clients = result.scalars().all()

    return list(clients), total


async def create_client(
    db: AsyncSession,
    data: ClientCreate,
    freelancer_id: uuid.UUID,
) -> ClientProfile:
    client = ClientProfile(**data.model_dump(), freelancer_id=freelancer_id)
    db.add(client)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A client with this email already exists",
        )
    await db.refresh(client)
    return client


async def update_client(
    db: AsyncSession,
    client_id: uuid.UUID,
    data: ClientUpdate,
    user_id: uuid.UUID,
) -> ClientProfile:
    client = await get_client_by_id(db, client_id, user_id)

    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("name", "") is None or update_data.get("email", "") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="name and email cannot be null",
        )
    changes = diff_changes(client, update_data)
    for field, value in update_data.items():
        setattr(client, field, value)
    if changes:
        log_activity(
            db,
            user_id=user_id,
            entity_type="client",
            entity_id=client.id,
            action="updated",
            summary=f"Updated client {client.name}",
            changes=changes,
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A client with this email already exists",
        )
    await db.refresh(client)
    return client


async def delete_client(
    db: AsyncSession,
    client_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    client = await get_client_by_id(db, client_id, user_id)
    await db.delete(client)
    try:
        await db.commit()
    except IntegrityError:
        # Invoices reference clients with ON DELETE RESTRICT: billing history
        # must survive, so a billed client cannot be deleted.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Client has invoices and cannot be deleted",
        )
