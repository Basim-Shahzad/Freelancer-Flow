from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import log_activity
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.VatRemittance import VatRemittance
from app.schemas.VatRemittanceSchema import VatRemittanceCreate, VatSummaryResponse

# VAT is owed on invoices that were actually issued to the client.
_ISSUED_STATUSES = (
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
)


async def create_remittance(
    db: AsyncSession, data: VatRemittanceCreate, freelancer: FreelancerProfile
) -> VatRemittance:
    values = data.model_dump()
    values["currency"] = values["currency"] or freelancer.currency
    values["paid_at"] = values["paid_at"] or datetime.now(timezone.utc)
    remittance = VatRemittance(**values, freelancer_id=freelancer.id)
    db.add(remittance)
    await db.flush()
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="vat_remittance",
        entity_id=remittance.id,
        action="created",
        summary=f"Recorded VAT payment {remittance.currency} {remittance.amount} "
        f"for {remittance.period_start} to {remittance.period_end}",
    )
    await db.commit()
    await db.refresh(remittance)
    return remittance


async def get_remittances(
    db: AsyncSession,
    freelancer_id: uuid.UUID,
    *,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[VatRemittance], int]:
    filters = [VatRemittance.freelancer_id == freelancer_id]
    total = (
        await db.execute(select(func.count(VatRemittance.id)).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(VatRemittance)
            .where(*filters)
            .order_by(VatRemittance.period_end.desc(), VatRemittance.paid_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total


async def delete_remittance(
    db: AsyncSession, remittance_id: uuid.UUID, freelancer: FreelancerProfile
) -> None:
    remittance = (
        await db.execute(
            select(VatRemittance).where(
                VatRemittance.id == remittance_id,
                VatRemittance.freelancer_id == freelancer.id,
            )
        )
    ).scalar_one_or_none()
    if remittance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="VAT remittance not found"
        )
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="vat_remittance",
        entity_id=remittance.id,
        action="deleted",
        summary="Deleted VAT payment record",
    )
    await db.delete(remittance)
    await db.commit()


async def vat_summary(
    db: AsyncSession,
    freelancer: FreelancerProfile,
    period_start: date,
    period_end: date,
    currency: Optional[str] = None,
) -> VatSummaryResponse:
    currency = currency or freelancer.currency
    start_dt = datetime.combine(period_start, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc)

    collected = (
        await db.execute(
            select(func.coalesce(func.sum(Invoice.tax_amount), 0)).where(
                Invoice.freelancer_id == freelancer.id,
                Invoice.currency == currency,
                Invoice.status.in_(_ISSUED_STATUSES),
                Invoice.issue_date >= start_dt,
                Invoice.issue_date < end_dt,
            )
        )
    ).scalar_one()
    remitted = (
        await db.execute(
            select(func.coalesce(func.sum(VatRemittance.amount), 0)).where(
                VatRemittance.freelancer_id == freelancer.id,
                VatRemittance.currency == currency,
                VatRemittance.period_end >= period_start,
                VatRemittance.period_end <= period_end,
            )
        )
    ).scalar_one()

    collected, remitted = Decimal(collected), Decimal(remitted)
    return VatSummaryResponse(
        period_start=period_start,
        period_end=period_end,
        currency=currency,
        vat_collected=collected,
        vat_remitted=remitted,
        vat_outstanding=max(collected - remitted, Decimal("0")),
    )
