from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.freelancers import update_freelancer_profile
from app.db.database import get_db
from app.schemas.FreelancerSchema import (
    FreelancerProfileResponse,
    FreelancerProfileUpdate,
)

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get(
    "",
    response_model=FreelancerProfileResponse,
    summary="Get the business profile",
    description="Business identity (printed on invoices), default currency, "
    "payment terms, VAT rate and hourly rate.",
    responses=errors(401, 403),
)
async def get_profile(freelancer: CurrentFreelancer):
    return freelancer


@router.patch(
    "",
    response_model=FreelancerProfileResponse,
    summary="Update the business profile",
    description="Changing `hourlyRate` affects only future time entries; existing "
    "entries keep the rate they were created with. Setting `bankBalance` stamps "
    "`bankBalanceUpdatedAt` and feeds the runway calculation.",
    responses=errors(401, 403, 422),
)
async def update_profile(
    data: FreelancerProfileUpdate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await update_freelancer_profile(db, freelancer, data)
