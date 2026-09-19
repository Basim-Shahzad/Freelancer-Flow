from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.invoices import (
    cancel_invoice,
    create_invoice,
    delete_invoice,
    get_invoice_by_id,
    get_invoice_events,
    get_invoices,
    remind_invoice,
    send_invoice,
    update_invoice,
)
from app.db.database import get_db
from app.schemas.InvoiceSchema import (
    InvoiceCreate,
    InvoiceDisplayStatus,
    InvoiceEventListResponse,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceSendResponse,
    InvoiceUpdate,
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get(
    "",
    response_model=InvoiceListResponse,
    summary="List invoices",
    description="`status=OVERDUE` is derived: open invoices past their due date. "
    "`SENT` / `PARTIALLY_PAID` exclude invoices that are already overdue.",
    responses=errors(401, 403),
)
async def list_invoices(
    freelancer: CurrentFreelancer,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status_filter: Optional[InvoiceDisplayStatus] = Query(None, alias="status"),
    client_id: Optional[uuid.UUID] = Query(None),
    project_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None, max_length=50, description="Invoice number"),
    db: AsyncSession = Depends(get_db),
):
    invoices, total = await get_invoices(
        db,
        freelancer.id,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        client_id=client_id,
        project_id=project_id,
        search=search,
    )
    return InvoiceListResponse(invoices=invoices, total=total)


@router.post(
    "",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a draft invoice",
    description=(
        "Builds a DRAFT from manual `items`, un-invoiced billable `timeEntryIds` "
        "(billed at each entry's rate snapshot) and `milestoneIds` (billed at the "
        "milestone amount; milestones needing approval must be APPROVED). "
        "Currency, terms and VAT rate default from the project / client / profile. "
        "Invoiced time entries are locked until the invoice is cancelled or deleted. "
        "Numbers are sequential per freelancer (e.g. `INV-0001`). "
        "`taxRate` and `discountRate` are percentages."
    ),
    responses=errors(401, 403, 404, 409, 422),
)
async def create_new_invoice(
    data: InvoiceCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await create_invoice(db, data, freelancer)


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
    summary="Get an invoice",
    responses=errors(401, 403, 404),
)
async def get_invoice(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await get_invoice_by_id(db, invoice_id, freelancer.id)


@router.patch(
    "/{invoice_id}",
    response_model=InvoiceResponse,
    summary="Edit a draft invoice",
    description="Only DRAFT invoices can be edited. Changing rates recomputes totals.",
    responses=errors(401, 403, 404, 409, 422),
)
async def update_existing_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await update_invoice(db, invoice_id, data, freelancer)


@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft invoice",
    description="Only DRAFT invoices can be deleted; their time entries become "
    "billable again. Use cancel for issued invoices.",
    responses=errors(401, 403, 404, 409),
)
async def delete_draft_invoice(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    await delete_invoice(db, invoice_id, freelancer)


@router.post(
    "/{invoice_id}/send",
    response_model=InvoiceSendResponse,
    summary="Send an invoice to the client",
    description="DRAFT -> SENT (stamps `sentAt`, logs a SENT event) and emails the "
    "client a link scoped to this invoice. Calling it again on an open invoice "
    "re-sends with a fresh link.",
    responses=errors(401, 403, 404, 409),
)
async def send_existing_invoice(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    invoice, url = await send_invoice(db, invoice_id, freelancer)
    return InvoiceSendResponse(invoice=invoice, portal_url=url)


@router.post(
    "/{invoice_id}/remind",
    response_model=InvoiceSendResponse,
    summary="Send a payment reminder",
    description="Only for sent, unpaid invoices. Rate-limited to one reminder per "
    "`INVOICE_REMINDER_MIN_INTERVAL_HOURS` (default 24h).",
    responses=errors(401, 403, 404, 409, 429),
)
async def remind_existing_invoice(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    invoice, url = await remind_invoice(db, invoice_id, freelancer)
    return InvoiceSendResponse(invoice=invoice, portal_url=url)


@router.post(
    "/{invoice_id}/cancel",
    response_model=InvoiceResponse,
    summary="Cancel an invoice",
    description="Not allowed for paid invoices or invoices with payments (void the "
    "payments first). Time entries become billable again and client links are revoked.",
    responses=errors(401, 403, 404, 409),
)
async def cancel_existing_invoice(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await cancel_invoice(db, invoice_id, freelancer)


@router.get(
    "/{invoice_id}/events",
    response_model=InvoiceEventListResponse,
    summary="Invoice lifecycle events",
    description="Sent / viewed / reminded / payment / paid / cancelled, oldest first.",
    responses=errors(401, 403, 404),
)
async def list_invoice_events(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    events = await get_invoice_events(db, invoice_id, freelancer.id)
    return InvoiceEventListResponse(events=events)
