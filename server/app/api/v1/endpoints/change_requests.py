from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.v1.openapi import errors
from app.db.crud.change_requests import (
    create_change_request,
    delete_change_request,
    get_change_request_by_id,
    get_change_requests,
    update_change_request,
)
from app.db.database import get_db
from app.models.ChangeRequest import ChangeRequestStatus
from app.models.User import User
from app.schemas.ChangeRequestSchema import (
    ChangeRequestCreate,
    ChangeRequestListResponse,
    ChangeRequestResponse,
    ChangeRequestUpdate,
)

router = APIRouter(prefix="/change-requests", tags=["Change Requests"])


@router.get(
    "",
    response_model=ChangeRequestListResponse,
    summary="List change requests",
    responses=errors(401),
)
async def list_change_requests(
    project_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[ChangeRequestStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = await get_change_requests(
        db,
        current_user.id,
        project_id=project_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )
    return ChangeRequestListResponse(change_requests=items, total=total)


@router.post(
    "",
    response_model=ChangeRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a scope change",
    description="Records and prices a scope change so scope creep stays visible.",
    responses=errors(401, 404),
)
async def create_new_change_request(
    data: ChangeRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_change_request(db, data, current_user.id)


@router.get(
    "/{change_request_id}",
    response_model=ChangeRequestResponse,
    summary="Get a change request",
    responses=errors(401, 404),
)
async def get_change_request(
    change_request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_change_request_by_id(db, change_request_id, current_user.id)


@router.patch(
    "/{change_request_id}",
    response_model=ChangeRequestResponse,
    summary="Edit or decide a change request",
    description="Edit content, or set `status` to APPROVED / REJECTED / WITHDRAWN "
    "to record the decision (optionally with `decisionNote`). Decisions are final.",
    responses=errors(401, 404, 409, 422),
)
async def update_existing_change_request(
    change_request_id: uuid.UUID,
    data: ChangeRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await update_change_request(db, change_request_id, data, current_user.id)


@router.delete(
    "/{change_request_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a change request",
    responses=errors(401, 404),
)
async def delete_existing_change_request(
    change_request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await delete_change_request(db, change_request_id, current_user.id)
