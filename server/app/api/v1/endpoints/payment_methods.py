from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.payment_methods import (
    create_method,
    delete_method,
    get_method_by_id,
    list_methods,
    reorder_methods,
    update_method,
)
from app.db.database import get_db
from app.schemas.PaymentMethodSchema import (
    PaymentMethodCreate,
    PaymentMethodListResponse,
    PaymentMethodOrder,
    PaymentMethodResponse,
    PaymentMethodUpdate,
)

router = APIRouter(prefix="/payment-methods", tags=["Payment methods"])


@router.get(
    "",
    response_model=PaymentMethodListResponse,
    summary="List payment methods",
    description="Ordered by `sortOrder`. Details are only ever shown to their owner.",
    responses=errors(401, 403),
)
async def list_payment_methods(
    freelancer: CurrentFreelancer,
    include_inactive: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    methods = await list_methods(db, freelancer.id, include_inactive=include_inactive)
    return PaymentMethodListResponse(payment_methods=methods)


@router.post(
    "",
    response_model=PaymentMethodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a payment method",
    description="`details` is validated per `type`. The first method added becomes a default.",
    responses=errors(401, 403),
)
async def create_payment_method(
    data: PaymentMethodCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await create_method(db, data, freelancer)


# Declared before `/{method_id}` so "order" is not parsed as an id.
@router.put(
    "/order",
    response_model=PaymentMethodListResponse,
    summary="Reorder payment methods",
    description="`ids` must list every one of your payment methods exactly once.",
    responses=errors(401, 403, 422),
)
async def reorder_payment_methods(
    data: PaymentMethodOrder,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    methods = await reorder_methods(db, data.ids, freelancer)
    return PaymentMethodListResponse(payment_methods=methods)


@router.get(
    "/{method_id}",
    response_model=PaymentMethodResponse,
    summary="Get a payment method",
    responses=errors(401, 403, 404),
)
async def get_payment_method(
    method_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await get_method_by_id(db, method_id, freelancer.id)


@router.patch(
    "/{method_id}",
    response_model=PaymentMethodResponse,
    summary="Update a payment method",
    description="`type` cannot change. `details`, when sent, replaces the old details.",
    responses=errors(401, 403, 404, 422),
)
async def update_payment_method(
    method_id: uuid.UUID,
    data: PaymentMethodUpdate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await update_method(db, method_id, data, freelancer)


@router.delete(
    "/{method_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a payment method",
    description="Issued invoices keep their own snapshot. Use `isActive: false` to retire a method instead.",
    responses=errors(401, 403, 404),
)
async def delete_payment_method(
    method_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    await delete_method(db, method_id, freelancer)
