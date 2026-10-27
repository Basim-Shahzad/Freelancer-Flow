from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import case, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.crud.invoices import OPEN_STATUSES
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.InvoiceItem import InvoiceItem
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.Payment import Payment
from app.models.Project import BillingType, Project, ProjectStatus
from app.models.TimeEntry import TimeEntry
from app.schemas.DashboardSchema import DashboardSummary
from app.services.invoicing import hours_from_minutes, quantize_money, time_entry_amount
from app.services.periods import local_window
from app.services.retainer import period_end, period_label, period_starts


def _dec(value: Any) -> Decimal:
    """SQL sums come back as float on SQLite and Decimal on Postgres."""
    return Decimal(str(value if value is not None else 0))


def _first_of_month(day: date, offset: int = 0) -> date:
    index = day.year * 12 + day.month - 1 + offset
    year, month = divmod(index, 12)
    return date(year, month + 1, 1)


def _currency(project: Project, freelancer: FreelancerProfile) -> str | None:
    """Same fallback chain as invoice creation; None when nothing is set."""
    return (
        project.currency
        or (project.client.currency if project.client else None)
        or freelancer.currency
    )


async def _cash_in(
    db: AsyncSession, freelancer: FreelancerProfile, today: date
) -> dict[str, Any]:
    this_start = _first_of_month(today)
    last_start = _first_of_month(today, -1)
    this_from, this_to = local_window(
        this_start, _first_of_month(today, 1) - timedelta(days=1), freelancer.timezone
    )
    last_from, _ = local_window(
        last_start, this_start - timedelta(days=1), freelancer.timezone
    )
    # Voiding a payment deletes the row, so every stored payment counts.
    rows = (
        await db.execute(
            select(
                Invoice.currency,
                func.sum(case((Payment.paid_at >= this_from, Payment.amount), else_=0)),
                func.sum(case((Payment.paid_at < this_from, Payment.amount), else_=0)),
            )
            .join(Invoice, Invoice.id == Payment.invoice_id)
            .where(
                Invoice.freelancer_id == freelancer.id,
                Payment.paid_at >= last_from,
                Payment.paid_at < this_to,
            )
            .group_by(Invoice.currency)
            .order_by(Invoice.currency)
        )
    ).all()
    this_month, last_month = [], []
    for currency, this_sum, last_sum in rows:
        if _dec(this_sum) != 0:
            this_month.append(
                {"currency": currency, "amount": quantize_money(_dec(this_sum), currency)}
            )
        if _dec(last_sum) != 0:
            last_month.append(
                {"currency": currency, "amount": quantize_money(_dec(last_sum), currency)}
            )
    return {
        "this_month": this_month,
        "last_month": last_month,
        "this_month_start": this_start,
        "last_month_start": last_start,
        "timezone": freelancer.timezone,
    }


async def _outstanding(
    db: AsyncSession, freelancer: FreelancerProfile, now: datetime
) -> dict[str, Any]:
    paid = (
        select(Payment.invoice_id.label("invoice_id"), func.sum(Payment.amount).label("paid"))
        .group_by(Payment.invoice_id)
        .subquery()
    )
    balance = Invoice.total - func.coalesce(paid.c.paid, 0)
    overdue = Invoice.due_date < now
    rows = (
        await db.execute(
            select(
                Invoice.currency,
                func.sum(balance),
                func.count(),
                func.sum(case((overdue, balance), else_=0)),
                func.sum(case((overdue, 1), else_=0)),
            )
            .select_from(Invoice)
            .outerjoin(paid, paid.c.invoice_id == Invoice.id)
            .where(
                Invoice.freelancer_id == freelancer.id,
                Invoice.status.in_(OPEN_STATUSES),
                balance > 0,
            )
            .group_by(Invoice.currency)
            .order_by(Invoice.currency)
        )
    ).all()
    return {
        "by_currency": [
            {
                "currency": currency,
                "balance": quantize_money(_dec(total), currency),
                "count": int(count),
                "overdue_balance": quantize_money(_dec(overdue_total), currency),
                "overdue_count": int(overdue_count or 0),
            }
            for currency, total, count, overdue_total, overdue_count in rows
        ]
    }


async def _projects_by_id(
    db: AsyncSession, ids: set[uuid.UUID]
) -> dict[uuid.UUID, Project]:
    if not ids:
        return {}
    projects = (
        await db.execute(
            select(Project).where(Project.id.in_(ids)).options(selectinload(Project.client))
        )
    ).scalars()
    return {p.id: p for p in projects}


async def _unbilled_time_and_milestones(
    db: AsyncSession, freelancer: FreelancerProfile
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    # Grouping by (rate, minutes) keeps the amount exact: invoicing rounds each
    # entry on its own, so count * time_entry_amount matches what would be billed.
    time_rows = (
        await db.execute(
            select(
                TimeEntry.project_id,
                TimeEntry.hourly_rate,
                TimeEntry.duration_minutes,
                func.count(),
            )
            .where(
                TimeEntry.user_id == freelancer.user_id,
                TimeEntry.is_billable.is_(True),
                TimeEntry.is_invoiced.is_(False),
                TimeEntry.end_time.is_not(None),
            )
            .group_by(
                TimeEntry.project_id, TimeEntry.hourly_rate, TimeEntry.duration_minutes
            )
        )
    ).all()
    already_billed = (
        exists()
        .where(
            InvoiceItem.milestone_id == Milestone.id,
            InvoiceItem.time_entry_id.is_(None),
            InvoiceItem.invoice_id == Invoice.id,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
        .correlate(Milestone)
    )
    milestone_rows = (
        await db.execute(
            select(Milestone.project_id, func.count(), func.sum(Milestone.amount))
            .join(Project, Project.id == Milestone.project_id)
            .where(
                Project.created_by == freelancer.user_id,
                Milestone.status == MilestoneStatus.APPROVED,
                Milestone.amount.is_not(None),
                ~already_billed,
            )
            .group_by(Milestone.project_id)
        )
    ).all()

    projects = await _projects_by_id(
        db, {r[0] for r in time_rows} | {r[0] for r in milestone_rows}
    )

    minutes: dict[uuid.UUID, int] = {}
    amounts: dict[uuid.UUID, Decimal] = {}
    for project_id, rate, duration, count in time_rows:
        minutes[project_id] = minutes.get(project_id, 0) + duration * count
        if rate is not None:
            currency = _currency(projects[project_id], freelancer)
            amounts[project_id] = amounts.get(project_id, Decimal(0)) + count * (
                time_entry_amount(duration, _dec(rate), currency)
            )
    time_out = []
    for project_id, total_minutes in minutes.items():
        project = projects[project_id]
        currency = _currency(project, freelancer)
        time_out.append(
            {
                "project_id": project_id,
                "project_name": project.name,
                "currency": currency,
                "hours": hours_from_minutes(total_minutes),
                "amount": quantize_money(amounts.get(project_id, Decimal(0)), currency),
            }
        )
    time_out.sort(key=lambda r: (r["project_name"], str(r["project_id"])))

    milestones_out = []
    for project_id, count, total in milestone_rows:
        project = projects[project_id]
        currency = _currency(project, freelancer)
        milestones_out.append(
            {
                "project_id": project_id,
                "project_name": project.name,
                "currency": currency,
                "count": int(count),
                "amount": quantize_money(_dec(total), currency),
            }
        )
    milestones_out.sort(key=lambda r: (r["project_name"], str(r["project_id"])))
    return time_out, milestones_out


async def _unbilled_retainer_periods(
    db: AsyncSession, freelancer: FreelancerProfile, today: date
) -> list[dict[str, Any]]:
    projects = (
        (
            await db.execute(
                select(Project)
                .where(
                    Project.created_by == freelancer.user_id,
                    Project.status == ProjectStatus.ACTIVE,
                    Project.billing_type == BillingType.RETAINER,
                    Project.retainer_amount.is_not(None),
                    Project.retainer_interval.is_not(None),
                    Project.retainer_start_date.is_not(None),
                )
                .options(selectinload(Project.client))
            )
        )
        .scalars()
        .all()
    )
    if not projects:
        return []
    billed = {
        (project_id, start)
        for project_id, start in (
            await db.execute(
                select(Invoice.project_id, Invoice.retainer_period_start).where(
                    Invoice.project_id.in_([p.id for p in projects]),
                    Invoice.retainer_period_start.is_not(None),
                    Invoice.status != InvoiceStatus.CANCELLED,
                )
            )
        ).all()
    }
    out = []
    for project in projects:
        currency = _currency(project, freelancer)
        for start in period_starts(
            project.retainer_start_date,
            project.retainer_interval,
            today,
            project.retainer_end_date,
        ):
            if (project.id, start) in billed:
                continue
            out.append(
                {
                    "project_id": project.id,
                    "project_name": project.name,
                    "currency": currency,
                    "period_start": start,
                    "period_end": period_end(
                        start, project.retainer_start_date, project.retainer_interval
                    ),
                    "label": period_label(start, project.retainer_interval),
                    "amount": quantize_money(_dec(project.retainer_amount), currency),
                }
            )
    out.sort(key=lambda r: (r["project_name"], r["period_start"]))
    return out


async def _running_timer(
    db: AsyncSession, freelancer: FreelancerProfile, now: datetime
) -> dict[str, Any] | None:
    row = (
        await db.execute(
            select(TimeEntry, Project.name)
            .join(Project, Project.id == TimeEntry.project_id)
            .where(TimeEntry.user_id == freelancer.user_id, TimeEntry.end_time.is_(None))
        )
    ).first()
    if row is None:
        return None
    entry, project_name = row
    started = entry.start_time
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    return {
        "id": entry.id,
        "project_id": entry.project_id,
        "project_name": project_name,
        "description": entry.description,
        "start_time": started,
        "elapsed_minutes": max(int((now - started).total_seconds() // 60), 0),
    }


async def dashboard_summary(
    db: AsyncSession, freelancer: FreelancerProfile
) -> DashboardSummary:
    now = datetime.now(UTC)
    today = now.astimezone(ZoneInfo(freelancer.timezone)).date()

    time_out, milestones_out = await _unbilled_time_and_milestones(db, freelancer)
    active_projects = (
        await db.execute(
            select(func.count())
            .select_from(Project)
            .where(
                Project.created_by == freelancer.user_id,
                Project.status == ProjectStatus.ACTIVE,
            )
        )
    ).scalar_one()

    return DashboardSummary.model_validate(
        {
            "cash_in": await _cash_in(db, freelancer, today),
            "outstanding": await _outstanding(db, freelancer, now),
            "unbilled": {
                "time": time_out,
                "milestones": milestones_out,
                "retainer_periods": await _unbilled_retainer_periods(
                    db, freelancer, today
                ),
            },
            "running_timer": await _running_timer(db, freelancer, now),
            "active_projects": active_projects,
        }
    )
