from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum
from decimal import Decimal
from apps.clients.models import Client
from apps.projects.models import Project
import re
from django.db import transaction
from django.core.exceptions import ValidationError
import uuid

STATUS_CHOICES = [
    ("draft", "Draft"),
    ("sent", "Sent"),
    ("paid", "Paid"),
    ("overdue", "Overdue"),
    ("cancelled", "Cancelled"),
]

class Invoice(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        "api.User", on_delete=models.CASCADE, related_name="invoices"
    )
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="invoices"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=50, blank=True, db_index=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, editable=False, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, editable=False, default=0)
    notes = models.TextField(blank=True)
    payment_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_hourly_basis(self):
        """
        Checks if the associated project is billed on an hourly basis.
        """
        if not self.project:
            return False

        return self.project.is_hourly_basis

    @property
    def is_overdue(self):
        """Check if invoice is overdue"""
        from django.utils import timezone

        return (
            self.status not in ["paid", "cancelled"]
            and self.due_date < timezone.now().date()
        )

    class Meta:
        ordering = ["invoice_number", "-created_at"]
        unique_together = ("user", "invoice_number")
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def clean(self):
        """Validate invoice data"""
        if self.due_date and self.issue_date and self.due_date < self.issue_date:
            raise ValidationError("Due date cannot be before issue date")

        if self.status == "paid" and not self.payment_date:
            raise ValidationError("Payment date required for paid invoices")

    def save(self, *args, **kwargs):

        # Generate invoice number
        if not self.invoice_number:
            with transaction.atomic():
                last_invoice = (
                    Invoice.objects.filter(user=self.user)
                    .exclude(invoice_number="")
                    .select_for_update()
                    .order_by("-invoice_number")
                    .first()
                )

                if not last_invoice:
                    self.invoice_number = "INV-0001"
                else:
                    # Extract number from last invoice
                    match = re.search(r"(\d+)", last_invoice.invoice_number)
                    if match:
                        last_number_str = match.group(1)
                        width = len(last_number_str)
                        new_number = int(last_number_str) + 1

                        prefix = last_invoice.invoice_number[: match.start()]
                        self.invoice_number = f"{prefix}{new_number:0{width}d}"
                    else:
                        # Fallback if no number found
                        self.invoice_number = f"INV-{last_invoice.id + 1:04d}"

        # Run validation
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.client.name}"


class InvoiceItem(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    description = models.TextField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        """Validate item data"""
        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than 0")
        if self.unit_price and self.unit_price < 0:
            raise ValidationError("Unit price cannot be negative")

    def save(self, *args, **kwargs):
        from decimal import Decimal, ROUND_HALF_UP

        if self.invoice.is_hourly_basis:
            # Quantity is in minutes, so divide by 60 to get hours
            hours = self.quantity / Decimal("60")
            if self.invoice.project.hourly_rate:
                unit_price = self.invoice.project.hourly_rate
            else:
                unit_price = self.invoice.user.hourly_rate
            calculated_amount = hours * unit_price
        else:
            # Fixed price: treat quantity as a standard multiplier (e.g., 1 project)
            calculated_amount = self.quantity * self.unit_price

        # Apply rounding (quantize to 2 decimal places)
        self.amount = calculated_amount.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        self.unit_price = unit_price

        # Run full validation and save to database
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} - ${self.amount}"

@receiver([post_save, post_delete], sender=InvoiceItem)
def update_invoice_totals(sender, instance, **kwargs):
    invoice = instance.invoice
    # Sum up all items
    aggregate = invoice.items.aggregate(total_sum=Sum("amount"))
    subtotal = aggregate["total_sum"] or Decimal("0.00")

    # Update the invoice directly
    invoice.subtotal = subtotal
    tax_rate = invoice.tax_rate or Decimal("0.00")
    invoice.tax_amount = subtotal * (tax_rate / Decimal("100"))
    invoice.total = subtotal + invoice.tax_amount

    # Use update() to avoid re-triggering save loops
    Invoice.objects.filter(pk=invoice.pk).update(
        subtotal=invoice.subtotal, tax_amount=invoice.tax_amount, total=invoice.total
    )
