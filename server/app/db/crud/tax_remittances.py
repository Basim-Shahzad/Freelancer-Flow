from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import log_activity
from app.models.FreelancerProfile import FreelancerProfile
from app.db.crud.currency import resolve_currency
from app.models.Invoice import Invoice, InvoiceStatus, InvoiceTax
from app.models.TaxRemittance import TaxRemittance
from app.schemas.TaxRemittanceSchema import TaxRemittanceCreate, TaxSummaryResponse

# Tax is owed on invoices that were actually issued to the client.
_ISSUED_STATUSES = (
    InvoiceStatus.SENT,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
)


async def create_remittance(
    db: AsyncSession, data: TaxRemittanceCreate, freelancer: FreelancerProfile
) -> TaxRemittance:
    values = data.model_dump()
    values["currency"] = resolve_currency(values["currency"], freelancer.currency)
    values["paid_at"] = values["paid_at"] or datetime.now(timezone.utc)
    remittance = TaxRemittance(**values, freelancer_id=freelancer.id)
    db.add(remittance)
    await db.flush()
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="tax_remittance",
        entity_id=remittance.id,
        action="created",
        summary=f"Recorded tax payment {remittance.currency} {remittance.amount} "
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
) -> tuple[list[TaxRemittance], int]:
    filters = [TaxRemittance.freelancer_id == freelancer_id]
    total = (
        await db.execute(select(func.count(TaxRemittance.id)).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(TaxRemittance)
            .where(*filters)
            .order_by(TaxRemittance.period_end.desc(), TaxRemittance.paid_at.desc())
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
            select(TaxRemittance).where(
                TaxRemittance.id == remittance_id,
                TaxRemittance.freelancer_id == freelancer.id,
            )
        )
    ).scalar_one_or_none()
    if remittance is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tax remittance not found"
        )
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="tax_remittance",
        entity_id=remittance.id,
        action="deleted",
        summary="Deleted tax payment record",
    )
    await db.delete(remittance)
    await db.commit()


def _local_window(period_start: date, period_end: date, tz_name: str):
    tz = ZoneInfo(tz_name)
    return (
        datetime.combine(period_start, time.min, tzinfo=tz).astimezone(timezone.utc),
        datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=tz).astimezone(
            timezone.utc
        ),
    )


async def tax_summary(
    db: AsyncSession,
    freelancer: FreelancerProfile,
    period_start: date,
    period_end: date,
    currency: Optional[str] = None,
    tax_name: Optional[str] = None,
) -> TaxSummaryResponse:
    currency = resolve_currency(currency, freelancer.currency)
    start_dt, end_dt = _local_window(period_start, period_end, freelancer.timezone)
    cash = freelancer.tax_basis == "cash"

    filters = [Invoice.freelancer_id == freelancer.id, Invoice.currency == currency]
    if cash:
        filters += [
            Invoice.status == InvoiceStatus.PAID,
            Invoice.payment_at >= start_dt,
            Invoice.payment_at < end_dt,
        ]
    else:
        filters += [
            Invoice.status.in_(_ISSUED_STATUSES),
            Invoice.issue_date >= start_dt,
            Invoice.issue_date < end_dt,
        ]

    if tax_name:
        query = (
            select(func.coalesce(func.sum(InvoiceTax.amount), 0))
            .join(Invoice, Invoice.id == InvoiceTax.invoice_id)
            .where(*filters, InvoiceTax.name == tax_name, InvoiceTax.is_withholding.is_(False))
        )
    else:
        query = select(func.coalesce(func.sum(Invoice.tax_amount), 0)).where(*filters)
    collected = (await db.execute(query)).scalar_one()

    remit_filters = [
        TaxRemittance.freelancer_id == freelancer.id,
        TaxRemittance.currency == currency,
        TaxRemittance.period_end >= period_start,
        TaxRemittance.period_end <= period_end,
    ]
    if tax_name:
        remit_filters.append(TaxRemittance.tax_name == tax_name)
    remitted = (
        await db.execute(
            select(func.coalesce(func.sum(TaxRemittance.amount), 0)).where(*remit_filters)
        )
    ).scalar_one()

    collected, remitted = Decimal(collected), Decimal(remitted)
    return TaxSummaryResponse(
        period_start=period_start,
        period_end=period_end,
        currency=currency,
        basis="cash" if cash else "accrual",
        tax_name=tax_name,
        tax_collected=collected,
        tax_remitted=remitted,
        tax_outstanding=max(collected - remitted, Decimal("0")),
    )
