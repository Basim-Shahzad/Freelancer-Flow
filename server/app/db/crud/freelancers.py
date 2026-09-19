from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.models.FreelancerProfile import FreelancerProfile
from app.schemas.FreelancerSchema import FreelancerProfileUpdate

# Columns that must never be set to NULL through PATCH.
_NOT_NULLABLE = {"currency", "default_payment_terms_days", "default_tax_rate"}


async def get_freelancer_by_user(
    db: AsyncSession, user_id: uuid.UUID
) -> FreelancerProfile:
    result = await db.execute(
        select(FreelancerProfile).where(FreelancerProfile.user_id == user_id)
    )
    freelancer = result.scalar_one_or_none()
    if freelancer is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A freelancer profile is required for this action",
        )
    return freelancer


async def update_freelancer_profile(
    db: AsyncSession,
    freelancer: FreelancerProfile,
    data: FreelancerProfileUpdate,
) -> FreelancerProfile:
    update_data = data.model_dump(exclude_unset=True)
    for field in _NOT_NULLABLE:
        if field in update_data and update_data[field] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{field} cannot be null",
            )
    if update_data.get("logo_url") is not None:
        update_data["logo_url"] = str(update_data["logo_url"])

    changes = diff_changes(freelancer, update_data)
    for field, value in update_data.items():
        setattr(freelancer, field, value)
    if "bank_balance" in update_data:
        freelancer.bank_balance_updated_at = datetime.now(timezone.utc)

    if changes:
        log_activity(
            db,
            user_id=freelancer.user_id,
            entity_type="profile",
            entity_id=freelancer.id,
            action="updated",
            summary="Updated business profile",
            changes=changes,
        )
    await db.commit()
    await db.refresh(freelancer)
    return freelancer
