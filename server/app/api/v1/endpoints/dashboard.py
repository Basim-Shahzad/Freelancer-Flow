from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.dashboard import dashboard_summary
from app.db.database import get_db
from app.schemas.DashboardSchema import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Dashboard summary",
    description="Cash received this and last month, outstanding invoices, unbilled "
    "work, the running timer and the active project count. Amounts are grouped by "
    "currency and never converted; months follow the profile timezone.",
    responses=errors(401, 403),
)
async def get_dashboard_summary(
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await dashboard_summary(db, freelancer)
