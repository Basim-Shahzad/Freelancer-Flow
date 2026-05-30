from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.utils.crud.clients import (
    get_client_by_id,
    get_clients,
    create_client,
    update_client,
    delete_client,
)
from app.schemas.ClientsSchema import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientListResponse,
)
from app.utils.dependencies.auth import get_current_user
from app.models.User import User

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("", response_model=ClientListResponse)
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    clients, total = await get_clients(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        search=search,
    )
    return ClientListResponse(clients=clients, total=total)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_client_by_id(db=db, client_id=client_id, user_id=current_user.id)


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_new_client(
    data: ClientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_client(db=db, data=data, user_id=current_user.id)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_existing_client(
    client_id: uuid.UUID,
    data: ClientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await update_client(
        db=db,
        client_id=client_id,
        data=data,
        user_id=current_user.id,
    )


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_client(
    client_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_client(db=db, client_id=client_id, user_id=current_user.id)
