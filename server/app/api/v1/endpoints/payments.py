from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import CurrentFreelancer
from app.api.v1.openapi import errors
from app.db.crud.invoices import get_invoice_by_id
from app.db.crud.payments import record_payment, void_payment
from app.db.database import get_db
from app.schemas.InvoiceSchema import InvoiceResponse
from app.schemas.PaymentSchema import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/invoices/{invoice_id}/payments", tags=["Payments"])


@router.get(
    "",
    response_model=list[PaymentResponse],
    summary="List an invoice's payments",
    responses=errors(401, 403, 404),
)
async def list_payments(
    invoice_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id)
    return invoice.payments


@router.post(
    "",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a payment",
    description="Records money received against a sent invoice. The invoice moves "
    "to PARTIALLY_PAID, or to PAID (stamping `paymentAt`) once the balance is "
    "cleared. Overpayments are rejected. Returns the updated invoice.",
    responses=errors(401, 403, 404, 409, 422),
)
async def add_payment(
    invoice_id: uuid.UUID,
    data: PaymentCreate,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await record_payment(db, invoice_id, data, freelancer)


@router.delete(
    "/{payment_id}",
    response_model=InvoiceResponse,
    summary="Void a payment",
    description="Removes a mistakenly recorded payment and re-derives the invoice "
    "status. Returns the updated invoice.",
    responses=errors(401, 403, 404, 409),
)
async def remove_payment(
    invoice_id: uuid.UUID,
    payment_id: uuid.UUID,
    freelancer: CurrentFreelancer,
    db: AsyncSession = Depends(get_db),
):
    return await void_payment(db, invoice_id, payment_id, freelancer)
