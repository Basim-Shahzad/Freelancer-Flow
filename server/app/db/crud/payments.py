from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.activity import log_activity
from app.db.crud.invoices import OPEN_STATUSES, add_event, get_invoice_by_id
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.InvoiceEvent import InvoiceEventType
from app.models.Payment import Payment
from app.schemas.PaymentSchema import PaymentCreate

_FUTURE_TOLERANCE = timedelta(minutes=5)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def sync_payment_status(invoice: Invoice) -> None:
    """Derive status / ``payment_at`` from the payments on the invoice.

    Called after every payment change so the stored status can never disagree
    with the ledger. (OVERDUE is derived elsewhere and never stored.)
    """
    if invoice.status in (InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED):
        return
    paid = invoice.amount_paid
    if paid >= invoice.total and invoice.payments:
        invoice.status = InvoiceStatus.PAID
        invoice.payment_at = max(_aware(p.paid_at) for p in invoice.payments)
    else:
        invoice.status = (
            InvoiceStatus.PARTIALLY_PAID if paid > Decimal("0") else InvoiceStatus.SENT
        )
        invoice.payment_at = None


async def record_payment(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    data: PaymentCreate,
    freelancer: FreelancerProfile,
) -> Invoice:
    # Row lock serialises concurrent payments so the balance check is safe.
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status == InvoiceStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Send the invoice before recording payments",
        )
    if invoice.status not in OPEN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot record a payment on an invoice in status {invoice.status.value}",
        )
    if data.amount > invoice.balance_due:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Payment exceeds the balance due ({invoice.balance_due})",
        )
    paid_at = data.paid_at or datetime.now(timezone.utc)
    if paid_at > datetime.now(timezone.utc) + _FUTURE_TOLERANCE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="paid_at cannot be in the future",
        )

    payment = Payment(
        amount=data.amount,
        paid_at=paid_at,
        method=data.method,
        reference=data.reference,
    )
    invoice.payments.append(payment)
    was_paid_before = invoice.status == InvoiceStatus.PAID
    sync_payment_status(invoice)

    add_event(
        db,
        invoice.id,
        InvoiceEventType.PAYMENT_RECORDED,
        f"{invoice.currency} {data.amount}" + (f" ({data.reference})" if data.reference else ""),
    )
    if invoice.status == InvoiceStatus.PAID and not was_paid_before:
        add_event(db, invoice.id, InvoiceEventType.PAID)
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="payment_recorded",
        summary=f"Recorded {invoice.currency} {data.amount} on {invoice.invoice_number}",
    )
    await db.commit()
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True)


async def void_payment(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    payment_id: uuid.UUID,
    freelancer: FreelancerProfile,
) -> Invoice:
    """Remove a mistakenly recorded payment and re-derive the invoice status."""
    invoice = await get_invoice_by_id(db, invoice_id, freelancer.id, for_update=True)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payments on a cancelled invoice cannot be changed",
        )
    payment = next((p for p in invoice.payments if p.id == payment_id), None)
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    amount = payment.amount
    invoice.payments.remove(payment)  # delete-orphan cascade removes the row
    sync_payment_status(invoice)
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type="invoice",
        entity_id=invoice.id,
        action="payment_voided",
        summary=f"Voided {invoice.currency} {amount} payment on {invoice.invoice_number}",
    )
    await db.commit()
    return await get_invoice_by_id(db, invoice.id, freelancer.id, refresh=True)
