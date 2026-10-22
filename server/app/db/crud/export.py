from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.invoices import _load_options
from app.db.crud.payment_methods import list_methods
from app.models.ActivityEvent import ActivityEvent
from app.models.ChangeRequest import ChangeRequest
from app.models.ClientProfile import ClientProfile
from app.models.Expense import Expense
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Invoice import Invoice
from app.models.Milestone import Milestone
from app.models.Project import Project
from app.models.TaxRemittance import TaxRemittance
from app.models.TimeEntry import TimeEntry
from app.models.User import User
from app.services import fx_fetch
from app.services.export import ExportData, invoice_to_dict, row_to_dict


async def _all(db: AsyncSession, query) -> list:
    return list((await db.execute(query)).scalars().all())


async def collect_export_data(
    db: AsyncSession, user: User, freelancer: FreelancerProfile, *, app_version: str
) -> ExportData:
    """Load every row the user owns. Async queries only; the result feeds the
    thread that builds the ZIP, which must not touch the session."""
    fid, uid = freelancer.id, user.id

    clients = await _all(
        db, select(ClientProfile).where(ClientProfile.freelancer_id == fid)
        .order_by(ClientProfile.created_at, ClientProfile.id)
    )
    projects = await _all(
        db, select(Project).where(Project.created_by == uid)
        .order_by(Project.created_at, Project.id)
    )
    milestones = await _all(
        db,
        select(Milestone)
        .join(Project, Milestone.project_id == Project.id)
        .where(Project.created_by == uid)
        .order_by(Milestone.project_id, Milestone.sort_order, Milestone.id),
    )
    time_entries = await _all(
        db, select(TimeEntry).where(TimeEntry.user_id == uid)
        .order_by(TimeEntry.start_time, TimeEntry.id)
    )
    invoices = await _all(
        db,
        select(Invoice)
        .where(Invoice.freelancer_id == fid)
        .options(*_load_options())
        .order_by(Invoice.created_at, Invoice.id),
    )
    expenses = await _all(
        db, select(Expense).where(Expense.freelancer_id == fid)
        .order_by(Expense.incurred_on, Expense.id)
    )
    remittances = await _all(
        db, select(TaxRemittance).where(TaxRemittance.freelancer_id == fid)
        .order_by(TaxRemittance.period_start, TaxRemittance.id)
    )
    change_requests = await _all(
        db,
        select(ChangeRequest)
        .join(Project, ChangeRequest.project_id == Project.id)
        .where(Project.created_by == uid)
        .order_by(ChangeRequest.requested_at, ChangeRequest.id),
    )
    methods = await list_methods(db, fid)
    activity = await _all(
        db, select(ActivityEvent).where(ActivityEvent.user_id == uid)
        .order_by(ActivityEvent.created_at, ActivityEvent.id)
    )

    payments = [
        {**row_to_dict(p), "invoice_number": inv.invoice_number}
        for inv in invoices
        for p in inv.payments
    ]
    profile = {
        "user": row_to_dict(user),
        "freelancer": row_to_dict(freelancer),
    }

    tables = {
        "profile": profile,
        "clients": [row_to_dict(c) for c in clients],
        "projects": [row_to_dict(p) for p in projects],
        "milestones": [row_to_dict(m) for m in milestones],
        "time_entries": [row_to_dict(t) for t in time_entries],
        "invoices": [invoice_to_dict(i) for i in invoices],
        "payments": payments,
        "expenses": [row_to_dict(e) for e in expenses],
        "tax_remittances": [row_to_dict(r) for r in remittances],
        "change_requests": [row_to_dict(c) for c in change_requests],
        "payment_methods": [row_to_dict(m) for m in methods],
        "activity": [row_to_dict(a) for a in activity],
    }
    return ExportData(
        tables=tables,
        invoices=invoices,
        rates=await fx_fetch.get_exchange_rates(db),
        app_version=app_version,
    )
