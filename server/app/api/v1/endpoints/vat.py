from __future__ import annotations

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.vat_remittances import (
    create_remittance,
    delete_remittance,
    get_remittances,
    vat_summary,
)
from app.db.database import get_db
from app.schemas.types import CurrencyCode
from app.schemas.VatRemittanceSchema import (
    VatRemittanceCreate,
    VatRemittanceListResponse,
    VatRemittanceResponse,
    VatSummaryResponse,
)

router = APIRouter(prefix="/vat", tags=["VAT"])


@router.get(
    "/summary",
    response_model=VatSummaryResponse,
    summary="VAT collected vs remitted",
    description="`vatCollected` is the tax on issued (non-draft, non-cancelled) "
    "invoices dated within the period; `vatRemitted` is the sum of recorded "
    "remittances whose period ends within it. Amounts are in one currency "
    "(default: the profile currency).",
    responses=errors(401, 403, 422),
)
async def get_vat_summary(
    freelancer: CurrentFreelancer,
    period_start: date = Query(...),
    period_end: date = Query(...),
    currency: Optional[CurrencyCode] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if period_end < period_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="period_end cannot be before period_start",
        )
    return await vat_summary(db, freelancer, period_start, period_end, currency)


@router.get(
    "/remittances",
    response_model=VatRemittanceListResponse,
    summary="List VAT remittances",
    responses=errors(401, 403),
)
async def list_remittances(
    freelancer: CurrentFreelancer,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    remittances, total = await get_remittances(db, freelancer.id, skip=skip, limit=limit)
    return VatRemittanceListResponse(remittances=remittances, total=total)


@router.post(
    "/remittances",
    response_model=VatRemittanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a VAT payment to the tax authority",
    responses=errors(401, 403),
)
async def add_remittance(
    data: VatRemittanceCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await create_remittance(db, data, freelancer)


@router.delete(
    "/remittances/{remittance_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a VAT remittance record",
    responses=errors(401, 403, 404),
)
async def remove_remittance(
    remittance_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    await delete_remittance(db, remittance_id, freelancer)
