from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal

from .models import Invoice

def mark_invoice_paid(invoice: Invoice, payment_date=None) -> Invoice:
    """
    Marks an invoice as paid and updates the user's revenue.
    Idempotent — safe to call multiple times.
    """
    if invoice.status == "paid":
        return invoice  # already paid, nothing to do

    if invoice.status == "cancelled":
        raise ValidationError("Cannot mark a cancelled invoice as paid.")

    with transaction.atomic():
        # Re-fetch with lock to prevent race conditions
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

        # Double-check status inside the lock
        if invoice.status == "paid":
            return invoice

        invoice.status = "paid"
        invoice.payment_date = payment_date or timezone.now().date()
        invoice.save(update_fields=["status", "payment_date", "updated_at"])

        # Update user revenue
        # Using F() expression to avoid race conditions on the user side
        from django.db.models import F

        invoice.user.revenue = F("revenue") + invoice.total
        invoice.user.save(update_fields=["revenue"])

    return invoice


def mark_invoice_unpaid(invoice: Invoice) -> Invoice:
    """
    Reverts a paid invoice back to sent, and subtracts the total from user revenue.
    Useful for corrections/disputes.
    """
    if invoice.status != "paid":
        raise ValidationError("Only paid invoices can be marked as unpaid.")

    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

        if invoice.status != "paid":
            raise ValidationError("Only paid invoices can be marked as unpaid.")

        invoice.status = "sent"
        invoice.payment_date = None
        invoice.save(update_fields=["status", "payment_date", "updated_at"])

        from django.db.models import F

        invoice.user.revenue = F("revenue") - invoice.total
        invoice.user.save(update_fields=["revenue"])

    return invoice
