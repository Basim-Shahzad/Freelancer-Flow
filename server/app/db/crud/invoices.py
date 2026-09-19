from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies.client_portal import issue_portal_token
from app.core.config import settings
from app.db.crud.activity import diff_changes, log_activity
from app.db.crud.projects import get_project_by_id
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.invoice_item import InvoiceItem
from app.models.InvoiceEvent import InvoiceEvent, InvoiceEventType
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.TimeEntry import TimeEntry
from app.schemas.InvoiceSchema import (
    InvoiceCreate,
    InvoiceDisplayStatus,
    InvoiceUpdate,
)
from app.services.email_service import (
    send_invoice_email,
    send_invoice_reminder_email,
)
from app.services.invoicing import (
    compute_totals,
    hours_from_minutes,
    line_amount,
    time_entry_amount,
)

# Statuses in which an invoice is awaiting money.
OPEN_STATUSES = (InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _load_options():
    """Everything InvoiceResponse renders (items / payments are selectin)."""
    return (
        selectinload(Invoice.client),
        selectinload(Invoice.project),
        selectinload(Invoice.freelancer).selectinload(FreelancerProfile.user),
    )


async def get_invoice_by_id(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    freelancer_id: uuid.UUID,
    *,
    for_update: bool = False,
    refresh: bool = False,
) -> Invoice:
    """Load an invoice owned by ``freelancer_id`` (404 otherwise)."""
    query = (
        select(Invoice)
        .where(Invoice.id == invoice_id, Invoice.freelancer_id == freelancer_id)
        .options(*_load_options())
    )
    if for_update:
        query = query.with_for_update()
    if refresh or for_update:
        # Never trust a copy loaded before the lock was granted.
        query = query.execution_options(populate_existing=True)
    invoice = (await db.execute(query)).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return invoice


async def get_invoices(
    db: AsyncSession,
    freelancer_id: uuid.UUID,
    *,
    skip: int = 0,
    limit: int = 20,
    status_filter: Optional[InvoiceDisplayStatus] = None,
    client_id: Optional[uuid.UUID] = None,
    project_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
) -> tuple[list[Invoice], int]:
    filters = [Invoice.freelancer_id == freelancer_id]
    if client_id:
        filters.append(Invoice.client_id == client_id)
    if project_id:
        filters.append(Invoice.project_id == project_id)
    if search:
        filters.append(Invoice.invoice_number.ilike(f"%{search}%"))
    if status_filter is InvoiceDisplayStatus.OVERDUE:
        # Derived state: open invoices past their due date.
        filters += [Invoice.status.in_(OPEN_STATUSES), Invoice.due_date < _now()]
    elif status_filter is not None:
        filters.append(Invoice.status == InvoiceStatus(status_filter.value))
        if status_filter in (InvoiceDisplayStatus.SENT, InvoiceDisplayStatus.PARTIALLY_PAID):
            # "Sent" / "part paid" exclude the ones that have gone overdue.
            filters.append(Invoice.due_date >= _now())

    total = (
        await db.execute(select(func.count(Invoice.id)).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(Invoice)
            .where(*filters)
            .options(*_load_options())
            .order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total


async def _next_invoice_number(db: AsyncSession, freelancer_id: uuid.UUID) -> str:
    """Gap-free per-freelancer number.

    A single atomic ``UPDATE ... RETURNING`` both increments the counter and
    takes the row lock (held until commit), so concurrent creations queue up
    and each draws a distinct value. A read-modify-write on the ORM object
    would be wrong here: the session may already hold a stale copy of the row.
    """
    sequence = (
        await db.execute(
            update(FreelancerProfile)
            .where(FreelancerProfile.id == freelancer_id)
            .values(invoice_sequence=FreelancerProfile.invoice_sequence + 1)
            .returning(FreelancerProfile.invoice_sequence)
        )
    ).scalar_one()
    return f"{settings.INVOICE_NUMBER_PREFIX}-{sequence:04d}"


def _unprocessable(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=detail)


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


async def _time_entry_items(
    db: AsyncSession, ids: list[uuid.UUID], project_id: uuid.UUID
) -> tuple[list[InvoiceItem], list[TimeEntry]]:
    unique_ids = list(dict.fromkeys(ids))
    entries = (
        await db.execute(
            select(TimeEntry)
            .where(TimeEntry.id.in_(unique_ids), TimeEntry.project_id == project_id)
            .with_for_update()
        )
    ).scalars().all()
    if len(entries) != len(unique_ids):
        raise _unprocessable("Some time entries were not found on this project")

    items: list[InvoiceItem] = []
    for entry in sorted(entries, key=lambda e: e.start_time):
        if entry.end_time is None:
            raise _conflict("A running timer cannot be invoiced; stop it first")
        if entry.is_invoiced:
            raise _conflict("A time entry has already been invoiced")
        if not entry.is_billable:
            raise _unprocessable("A time entry is marked non-billable")
        if entry.hourly_rate is None:
            raise _unprocessable(
                "A time entry has no hourly rate; set a rate on the project or profile"
            )
        items.append(
            InvoiceItem(
                time_entry_id=entry.id,
                milestone_id=entry.milestone_id,
                description=entry.description,
                quantity=hours_from_minutes(entry.duration_minutes),
                unit_price=entry.hourly_rate,
                amount=time_entry_amount(entry.duration_minutes, entry.hourly_rate),
            )
        )
    return items, list(entries)


async def _milestone_items(
    db: AsyncSession, ids: list[uuid.UUID], project_id: uuid.UUID
) -> list[InvoiceItem]:
    unique_ids = list(dict.fromkeys(ids))
    milestones = (
        await db.execute(
            select(Milestone)
            .where(Milestone.id.in_(unique_ids), Milestone.project_id == project_id)
            .with_for_update()
        )
    ).scalars().all()
    if len(milestones) != len(unique_ids):
        raise _unprocessable("Some milestones were not found on this project")

    already_billed = (
        await db.execute(
            select(InvoiceItem.milestone_id)
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(
                InvoiceItem.milestone_id.in_(unique_ids),
                InvoiceItem.time_entry_id.is_(None),
                Invoice.status != InvoiceStatus.CANCELLED,
            )
        )
    ).scalars().all()
    if already_billed:
        raise _conflict("A milestone has already been invoiced")

    items: list[InvoiceItem] = []
    for milestone in sorted(milestones, key=lambda m: m.sort_order):
        if milestone.amount is None:
            raise _unprocessable(f"Milestone '{milestone.name}' has no amount")
        if milestone.approval_required and milestone.status != MilestoneStatus.APPROVED:
            raise _conflict(
                f"Milestone '{milestone.name}' must be approved before it is invoiced"
            )
        items.append(
            InvoiceItem(
                milestone_id=milestone.id,
                description=milestone.name,
                quantity=Decimal("1"),
                unit_price=milestone.amount,
                amount=milestone.amount,
            )
        )
    return items


async def create_invoice(
    db: AsyncSession,
    data: InvoiceCreate,
    freelancer: FreelancerProfile,
) -> Invoice:
    project = await get_project_by_id(db, data.project_id, freelancer.user_id)
    client = project.client

    currency = data.currency or project.currency or client.currency or freelancer.currency
    issue_date = data.issue_date or _now()
    terms = (
        client.payment_terms_days
        if client.payment_terms_days is not None
        else freelancer.default_payment_terms_days
    )
    due_date = data.due_date or issue_date + timedelta(days=terms)
    tax_rate = data.tax_rate if data.tax_rate is not None else freelancer.default_tax_rate

    items: list[InvoiceItem] = [
        InvoiceItem(
            description=i.description,
            quantity=i.quantity,
            unit_price=i.unit_price,
            amount=line_amount(i.quantity, i.unit_price),
        )
        for i in data.items
    ]
    billed_entries: list[TimeEntry] = []
    if data.time_entry_ids:
        entry_items, billed_entries = await _time_entry_items(
            db, data.time_entry_ids, project.id
        )
        items += entry_items
    if data.milestone_ids:
        items += await _milestone_items(db, data.milestone_ids, project.id)

    subtotal = sum((i.amount for i in items), Decimal("0.00"))
    discount_amount, tax_amount, total = compute_totals(
        subtotal, data.discount_rate, tax_rate
    )

    invoice = Invoice(
        invoice_number=await _next_invoice_number(db, freelancer.id),
        issue_date=issue_date,
        due_date=due_date,
        status=InvoiceStatus.DRAFT,
        currency=currency,
        freelancer_id=freelancer.id,
        client_id=client.id,
        project_id=project.id,
        items=items,
        subtotal=subtotal,
        discount_rate=data.discount_rate,
        discount_amount=discount_amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=total,
        notes=data.notes,
    )
    db.add(invoice)
    for entry in billed_entries:
        entry.is_invoiced = True
    try:
        await db.flush()
        log_activity(
            db,
            user_id=freelancer.user_id,
            entity_type="invoice",
            entity_id=invoice.id,
            action="created",
            summary=f"Created invoice {invoice.invoice_number} ({currency} {total})",
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise _conflict("Could not allocate an invoice number; please retry")
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True)


async def update_invoice(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    freelancer: FreelancerProfile,
) -> Invoice:
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status != InvoiceStatus.DRAFT:
        raise _conflict("Only draft invoices can be edited")

    update_data = data.model_dump(exclude_unset=True)
    for required in ("issue_date", "due_date", "tax_rate", "discount_rate"):
        if required in update_data and update_data[required] is None:
            raise _unprocessable(f"{required} cannot be null")

    issue = _aware(update_data.get("issue_date") or invoice.issue_date)
    due = _aware(update_data.get("due_date") or invoice.due_date)
    if due < issue:
        raise _unprocessable("due_date cannot be before issue_date")

    changes = diff_changes(invoice, update_data)
    for field, value in update_data.items():
        setattr(invoice, field, value)
    if "tax_rate" in update_data or "discount_rate" in update_data:
        invoice.discount_amount, invoice.tax_amount, invoice.total = compute_totals(
            invoice.subtotal, invoice.discount_rate, invoice.tax_rate
        )
    if changes:
        log_activity(
            db,
            user_id=freelancer.user_id,
            entity_type="invoice",
            entity_id=invoice.id,
            action="updated",
            summary=f"Updated invoice {invoice.invoice_number}",
            changes=changes,
        )
    await db.commit()
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True)


async def _release_time_entries(db: AsyncSession, invoice: Invoice) -> None:
    """Make an invoice's time entries billable again."""
    entry_ids = [i.time_entry_id for i in invoice.items if i.time_entry_id]
    if entry_ids:
        await db.execute(
            update(TimeEntry).where(TimeEntry.id.in_(entry_ids)).values(is_invoiced=False)
        )


async def delete_invoice(
    db: AsyncSession, invoice_id: uuid.UUID, freelancer: FreelancerProfile
) -> None:
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status != InvoiceStatus.DRAFT:
        raise _conflict("Only draft invoices can be deleted; cancel it instead")
    await _release_time_entries(db, invoice)
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="deleted",
        summary=f"Deleted draft invoice {invoice.invoice_number}",
    )
    await db.delete(invoice)
    await db.commit()


def add_event(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    event_type: InvoiceEventType,
    detail: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    db.add(
        InvoiceEvent(
            invoice_id=invoice_id,
            event_type=event_type,
            detail=detail,
            ip_address=ip_address,
        )
    )


async def get_invoice_events(
    db: AsyncSession, invoice_id: uuid.UUID, freelancer_id: uuid.UUID
) -> list[InvoiceEvent]:
    invoice = await get_invoice_by_id(db, invoice_id, freelancer_id)
    result = await db.execute(
        select(InvoiceEvent)
        .where(InvoiceEvent.invoice_id == invoice.id)
        .order_by(InvoiceEvent.occurred_at, InvoiceEvent.id)
    )
    return list(result.scalars().all())


def portal_url(invoice_id: uuid.UUID, token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/portal/invoices/{invoice_id}?token={token}"


async def send_invoice(
    db: AsyncSession, invoice_id: uuid.UUID, freelancer: FreelancerProfile
) -> tuple[Invoice, str]:
    """Issue (or re-send) an invoice to the client.

    DRAFT becomes SENT and stamps ``sent_at``. Re-sending an open invoice
    issues a fresh link without changing its state.
    """
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status not in (InvoiceStatus.DRAFT, *OPEN_STATUSES):
        raise _conflict(f"Cannot send an invoice in status {invoice.status.value}")

    first_send = invoice.status == InvoiceStatus.DRAFT
    if first_send:
        invoice.status = InvoiceStatus.SENT
        invoice.sent_at = _now()

    token = await issue_portal_token(
        db,
        client_id=invoice.client_id,
        scope_type=ScopeType.INVOICE,
        scope_id=invoice.id,
        commit=False,
    )
    add_event(db, invoice.id, InvoiceEventType.SENT, "Sent" if first_send else "Re-sent")
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="sent" if first_send else "resent",
        summary=f"Sent invoice {invoice.invoice_number} to {invoice.client.name}",
    )
    await db.commit()

    url = portal_url(invoice.id, token)
    await send_invoice_email(
        to_email=invoice.client.email,
        client_name=invoice.client.name,
        invoice_number=invoice.invoice_number,
        total=str(invoice.total),
        currency=invoice.currency,
        due_date=invoice.due_date,
        portal_url=url,
    )
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True), url


async def remind_invoice(
    db: AsyncSession, invoice_id: uuid.UUID, freelancer: FreelancerProfile
) -> tuple[Invoice, str]:
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status not in OPEN_STATUSES:
        raise _conflict("Reminders can only be sent for unpaid, sent invoices")

    reminders = (
        await db.execute(
            select(InvoiceEvent.occurred_at)
            .where(
                InvoiceEvent.invoice_id == invoice.id,
                InvoiceEvent.event_type == InvoiceEventType.REMINDED,
            )
            .order_by(InvoiceEvent.occurred_at.desc())
        )
    ).scalars().all()
    if reminders:
        gap = _now() - _aware(reminders[0])
        if gap < timedelta(hours=settings.INVOICE_REMINDER_MIN_INTERVAL_HOURS):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="A reminder was sent recently; try again later",
            )

    token = await issue_portal_token(
        db,
        client_id=invoice.client_id,
        scope_type=ScopeType.INVOICE,
        scope_id=invoice.id,
        commit=False,
    )
    add_event(db, invoice.id, InvoiceEventType.REMINDED, f"Reminder #{len(reminders) + 1}")
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="reminded",
        summary=f"Reminded {invoice.client.name} about {invoice.invoice_number}",
    )
    await db.commit()

    url = portal_url(invoice.id, token)
    await send_invoice_reminder_email(
        to_email=invoice.client.email,
        client_name=invoice.client.name,
        invoice_number=invoice.invoice_number,
        balance_due=str(invoice.balance_due),
        currency=invoice.currency,
        due_date=invoice.due_date,
        overdue=invoice.is_overdue,
        portal_url=url,
    )
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True), url


async def cancel_invoice(
    db: AsyncSession, invoice_id: uuid.UUID, freelancer: FreelancerProfile
) -> Invoice:
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise _conflict("Invoice is already cancelled")
    if invoice.status == InvoiceStatus.PAID:
        raise _conflict("A paid invoice cannot be cancelled")
    if invoice.amount_paid > 0:
        raise _conflict("Invoice has payments; void them before cancelling")

    invoice.status = InvoiceStatus.CANCELLED
    await _release_time_entries(db, invoice)
    # Kill any outstanding client links to this invoice.
    await db.execute(
        update(PortalAccessToken)
        .where(
            PortalAccessToken.scope_type == ScopeType.INVOICE,
            PortalAccessToken.scope == invoice.id,
            PortalAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=_now())
    )
    if invoice.sent_at is not None:
        add_event(db, invoice.id, InvoiceEventType.CANCELLED)
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="cancelled",
        summary=f"Cancelled invoice {invoice.invoice_number}",
    )
    await db.commit()
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True)


async def mark_invoice_viewed(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    client_id: uuid.UUID,
    ip_address: Optional[str],
) -> Invoice:
    """Portal read: return the invoice and stamp the first view."""
    invoice = (
        await db.execute(
            select(Invoice)
            .where(
                Invoice.id == invoice_id,
                Invoice.client_id == client_id,
                Invoice.status != InvoiceStatus.DRAFT,
            )
            .options(*_load_options())
        )
    ).scalar_one_or_none()
    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    if invoice.viewed_at is None:
        invoice.viewed_at = _now()
        add_event(db, invoice.id, InvoiceEventType.VIEWED, ip_address=ip_address)
        await db.commit()
    return invoice
