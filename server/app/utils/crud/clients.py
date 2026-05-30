from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.Client import Client
from app.schemas.ClientsSchema import ClientCreate, ClientUpdate


async def get_client_by_id(
    db: AsyncSession,
    client_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Client:
    result = await db.execute(
        select(Client).where(Client.id == client_id, Client.user_id == user_id)
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
) -> tuple[list[Client], int]:
    query = select(Client).where(Client.user_id == user_id)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            Client.name.ilike(search_filter)
            | Client.email.ilike(search_filter)
            | Client.company_name.ilike(search_filter)
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Client.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    clients = result.scalars().all()

    return list(clients), total


async def create_client(
    db: AsyncSession,
    data: ClientCreate,
    user_id: uuid.UUID,
) -> Client:
    client = Client(**data.model_dump(), user_id=user_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def update_client(
    db: AsyncSession,
    client_id: uuid.UUID,
    data: ClientUpdate,
    user_id: uuid.UUID,
) -> Client:
    client = await get_client_by_id(db, client_id, user_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    await db.commit()
    await db.refresh(client)
    return client


async def delete_client(
    db: AsyncSession,
    client_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    client = await get_client_by_id(db, client_id, user_id)
    await db.delete(client)
    await db.commit()
