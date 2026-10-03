from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.tax_remittances import (
    create_remittance,
    delete_remittance,
    get_remittances,
    tax_summary,
)
from app.db.database import get_db
from app.schemas.types import CurrencyCode
from app.schemas.TaxRemittanceSchema import (
    TaxRemittanceCreate,
    TaxRemittanceListResponse,
    TaxRemittanceResponse,
    TaxSummaryResponse,
)

router = APIRouter(prefix="/tax", tags=["Tax"])


@router.get(
    "/summary",
    response_model=TaxSummaryResponse,
    summary="Tax collected vs remitted",
    description="`taxCollected` is the tax on invoices in the period (issued in "
    "it on the accrual basis, fully paid in it on the cash basis; see the "
    "profile's `taxBasis`); `taxRemitted` is the sum of recorded remittances "
    "whose period ends within it. Filter by `taxName` to report one tax. "
    "Amounts are in one currency (default: the profile currency).",
    responses=errors(401, 403, 422),
)
async def get_tax_summary(
    freelancer: CurrentFreelancer,
    period_start: date = Query(...),
    period_end: date = Query(...),
    currency: Optional[CurrencyCode] = Query(None),
    tax_name: Optional[str] = Query(None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    if period_end < period_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="period_end cannot be before period_start",
        )
    return await tax_summary(db, freelancer, period_start, period_end, currency, tax_name)


@router.get(
    "/remittances",
    response_model=TaxRemittanceListResponse,
    summary="List tax remittances",
    responses=errors(401, 403),
)
async def list_remittances(
    freelancer: CurrentFreelancer,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    remittances, total = await get_remittances(db, freelancer.id, skip=skip, limit=limit)
    return TaxRemittanceListResponse(remittances=remittances, total=total)


@router.post(
    "/remittances",
    response_model=TaxRemittanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a tax payment to a tax authority",
    responses=errors(401, 403),
)
async def add_remittance(
    data: TaxRemittanceCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await create_remittance(db, data, freelancer)


@router.delete(
    "/remittances/{remittance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a tax remittance record",
    responses=errors(401, 403, 404),
)
async def remove_remittance(
    remittance_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    await delete_remittance(db, remittance_id, freelancer)
