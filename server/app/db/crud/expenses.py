from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.projects import get_project_by_id
from app.models.Expense import Expense, RecurrenceInterval
from app.models.FreelancerProfile import FreelancerProfile
from app.schemas.ExpenseSchema import (
    CashRunwayResponse,
    ExpenseCreate,
    ExpenseUpdate,
)
from app.services.invoicing import quantize_money

_MONTHS_PER_INTERVAL = {
    RecurrenceInterval.MONTHLY: Decimal(1),
    RecurrenceInterval.QUARTERLY: Decimal(3),
    RecurrenceInterval.YEARLY: Decimal(12),
}
RUNWAY_LOOKBACK_MONTHS = 3


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail)


async def _check_project(
    db: AsyncSession, project_id: Optional[uuid.UUID], freelancer: FreelancerProfile
) -> None:
    if project_id is not None:
        # 404 unless the project belongs to the caller.
        await get_project_by_id(db, project_id, freelancer.user_id)


async def get_expense_by_id(
    db: AsyncSession, expense_id: uuid.UUID, freelancer_id: uuid.UUID
) -> Expense:
    expense = (
        await db.execute(
            select(Expense).where(
                Expense.id == expense_id, Expense.freelancer_id == freelancer_id
            )
        )
    ).scalar_one_or_none()
    if expense is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found"
        )
    return expense


async def get_expenses(
    db: AsyncSession,
    freelancer_id: uuid.UUID,
    *,
    skip: int = 0,
    limit: int = 20,
    project_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    is_recurring: Optional[bool] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> tuple[list[Expense], int]:
    filters = [Expense.freelancer_id == freelancer_id]
    if project_id:
        filters.append(Expense.project_id == project_id)
    if category:
        filters.append(Expense.category == category)
    if is_recurring is not None:
        filters.append(Expense.is_recurring == is_recurring)
    if date_from:
        filters.append(Expense.incurred_on >= date_from)
    if date_to:
        filters.append(Expense.incurred_on <= date_to)

    total = (await db.execute(select(func.count(Expense.id)).where(*filters))).scalar_one()
    rows = (
        await db.execute(
            select(Expense)
            .where(*filters)
            .order_by(Expense.incurred_on.desc(), Expense.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total


async def create_expense(
    db: AsyncSession, data: ExpenseCreate, freelancer: FreelancerProfile
) -> Expense:
    await _check_project(db, data.project_id, freelancer)
    values = data.model_dump()
    values["currency"] = values["currency"] or freelancer.currency
    expense = Expense(**values, freelancer_id=freelancer.id)
    db.add(expense)
    await db.flush()
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="expense",
        entity_id=expense.id,
        action="created",
        summary=f"Recorded expense {expense.description} ({expense.currency} {expense.amount})",
    )
    await db.commit()
    await db.refresh(expense)
    return expense


async def update_expense(
    db: AsyncSession,
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    freelancer: FreelancerProfile,
) -> Expense:
    expense = await get_expense_by_id(db, expense_id, freelancer.id)
    update_data = data.model_dump(exclude_unset=True)
    for required in ("description", "amount", "incurred_on", "currency", "is_recurring"):
        if required in update_data and update_data[required] is None:
            raise _unprocessable(f"{required} cannot be null")
    await _check_project(db, update_data.get("project_id"), freelancer)

    # Validate the merged result, not just the patch.
    is_recurring = update_data.get("is_recurring", expense.is_recurring)
    recurrence = update_data["recurrence"] if "recurrence" in update_data else expense.recurrence
    if is_recurring and recurrence is None:
        raise _unprocessable("recurrence is required when is_recurring is true")
    if not is_recurring:
        update_data["recurrence"] = None
        update_data["recurrence_ends_on"] = None
    ends = (
        update_data["recurrence_ends_on"]
        if "recurrence_ends_on" in update_data
        else expense.recurrence_ends_on
    )
    if ends is not None and ends < update_data.get("incurred_on", expense.incurred_on):
        raise _unprocessable("recurrence_ends_on cannot be before incurred_on")

    changes = diff_changes(expense, update_data)
    for field, value in update_data.items():
        setattr(expense, field, value)
    if changes:
        log_activity(
            db,
            user_id=freelancer.user_id,
            entity_type="expense",
            entity_id=expense.id,
            action="updated",
            summary=f"Updated expense {expense.description}",
            changes=changes,
        )
    await db.commit()
    await db.refresh(expense)
    return expense


async def delete_expense(
    db: AsyncSession, expense_id: uuid.UUID, freelancer: FreelancerProfile
) -> None:
    expense = await get_expense_by_id(db, expense_id, freelancer.id)
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="expense",
        entity_id=expense.id,
        action="deleted",
        summary=f"Deleted expense {expense.description}",
    )
    await db.delete(expense)
    await db.commit()


def _months_back(today: date, months: int) -> date:
    index = today.year * 12 + (today.month - 1) - months
    year, month = divmod(index, 12)
    day = min(today.day, 28)
    return date(year, month + 1, day)


async def cash_runway(
    db: AsyncSession, freelancer: FreelancerProfile
) -> CashRunwayResponse:
    """Burn and months of runway from expenses and the self-reported balance.

    Only expenses in the freelancer's own currency are counted; mixing
    currencies without FX rates would silently produce wrong numbers.
    """
    today = datetime.now(timezone.utc).date()
    base = [
        Expense.freelancer_id == freelancer.id,
        Expense.currency == freelancer.currency,
    ]

    recurring = (
        await db.execute(
            select(Expense).where(
                *base,
                Expense.is_recurring.is_(True),
                Expense.incurred_on <= today,
                (Expense.recurrence_ends_on.is_(None))
                | (Expense.recurrence_ends_on >= today),
            )
        )
    ).scalars().all()
    monthly_recurring = sum(
        (e.amount / _MONTHS_PER_INTERVAL[e.recurrence] for e in recurring if e.recurrence),
        Decimal("0"),
    )

    since = _months_back(today, RUNWAY_LOOKBACK_MONTHS)
    one_off_total = (
        await db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                *base,
                Expense.is_recurring.is_(False),
                Expense.incurred_on > since,
                Expense.incurred_on <= today,
            )
        )
    ).scalar_one()
    monthly_one_off = Decimal(one_off_total) / RUNWAY_LOOKBACK_MONTHS

    burn = monthly_recurring + monthly_one_off
    balance = freelancer.bank_balance
    runway: Optional[Decimal] = None
    if balance is not None and burn > 0:
        runway = max(balance, Decimal("0")) / burn
        runway = runway.quantize(Decimal("0.1"))

    return CashRunwayResponse(
        currency=freelancer.currency,
        monthly_recurring=quantize_money(monthly_recurring),
        monthly_one_off_average=quantize_money(monthly_one_off),
        monthly_burn=quantize_money(burn),
        lookback_months=RUNWAY_LOOKBACK_MONTHS,
        bank_balance=balance,
        bank_balance_updated_at=freelancer.bank_balance_updated_at,
        runway_months=runway,
    )
