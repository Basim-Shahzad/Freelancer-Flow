from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.expenses import (
    cash_runway,
    create_expense,
    delete_expense,
    get_expense_by_id,
    get_expenses,
    update_expense,
)
from app.db.database import get_db
from app.schemas.ExpenseSchema import (
    CashRunwayResponse,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseResponse,
    ExpenseUpdate,
)

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get(
    "",
    response_model=ExpenseListResponse,
    summary="List expenses",
    responses=errors(401, 403),
)
async def list_expenses(
    freelancer: CurrentFreelancer,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    project_id: Optional[uuid.UUID] = Query(None),
    category: Optional[str] = Query(None, max_length=100),
    is_recurring: Optional[bool] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    expenses, total = await get_expenses(
        db,
        freelancer.id,
        skip=skip,
        limit=limit,
        project_id=project_id,
        category=category,
        is_recurring=is_recurring,
        date_from=date_from,
        date_to=date_to,
    )
    return ExpenseListResponse(expenses=expenses, total=total)


@router.get(
    "/runway",
    response_model=CashRunwayResponse,
    summary="Burn rate and cash runway",
    description="Monthly burn = active recurring costs (normalised to a month) + the "
    "trailing 3-month average of one-off costs. Runway = bank balance / burn, using "
    "the balance set on `PATCH /profile`. Only expenses in the profile currency count.",
    responses=errors(401, 403),
)
async def get_cash_runway(
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await cash_runway(db, freelancer)


@router.post(
    "",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an expense",
    description="One-off, or recurring (`isRecurring` + `recurrence`) until "
    "`recurrenceEndsOn`. Currency defaults to the profile currency.",
    responses=errors(401, 403, 404),
)
async def create_new_expense(
    data: ExpenseCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await create_expense(db, data, freelancer)


@router.get(
    "/{expense_id}",
    response_model=ExpenseResponse,
    summary="Get an expense",
    responses=errors(401, 403, 404),
)
async def get_expense(
    expense_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await get_expense_by_id(db, expense_id, freelancer.id)


@router.patch(
    "/{expense_id}",
    response_model=ExpenseResponse,
    summary="Update an expense",
    responses=errors(401, 403, 404, 422),
)
async def update_existing_expense(
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await update_expense(db, expense_id, data, freelancer)


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense",
    responses=errors(401, 403, 404),
)
async def delete_existing_expense(
    expense_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    await delete_expense(db, expense_id, freelancer)
