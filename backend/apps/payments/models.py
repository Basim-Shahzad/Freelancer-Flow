from django.db import models
from apps.clients.models import Client
from apps.projects.models import Project
import re
from django.db import transaction
from django.core.exceptions import ValidationError


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='invoices')
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices')
    project = models.ForeignKey(Project, on_delete=models.PROTECT, null=True, blank=True, related_name='invoices')
    invoice_number = models.CharField(max_length=50, blank=True, db_index=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='draft')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    notes = models.TextField(blank=True)
    payment_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issue_date', '-created_at']
        unique_together = ('user', 'invoice_number')
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status', 'due_date']),
        ]

    def clean(self):
        """Validate invoice data"""
        if self.due_date and self.issue_date and self.due_date < self.issue_date:
            raise ValidationError("Due date cannot be before issue date")
        
        if self.status == 'paid' and not self.payment_date:
            raise ValidationError("Payment date required for paid invoices")

    def save(self, *args, **kwargs):
        from decimal import Decimal, ROUND_HALF_UP
        
        # Calculate tax and total with proper rounding
        self.tax_amount = (self.subtotal * (self.tax_rate / Decimal('100'))).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        self.total = (self.subtotal + self.tax_amount).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        # Generate invoice number if not provided
        if not self.invoice_number:
            with transaction.atomic():
                # Lock the table to prevent race conditions
                last_invoice = (
                    Invoice.objects
                    .filter(user=self.user)
                    .select_for_update()
                    .order_by('-created_at')
                    .first()
                )

                if not last_invoice or not last_invoice.invoice_number:
                    self.invoice_number = "INV-0001"
                else:
                    # Extract number from last invoice
                    match = re.search(r'(\d+)', last_invoice.invoice_number)
                    if match:
                        last_number_str = match.group(1)
                        width = len(last_number_str)
                        new_number = int(last_number_str) + 1
                        
                        prefix = last_invoice.invoice_number[:match.start()]
                        self.invoice_number = f"{prefix}{new_number:0{width}d}"
                    else:
                        # Fallback if no number found
                        self.invoice_number = f"INV-{last_invoice.id + 1:04d}"

        # Run validation
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.client.name}"
    
    @property
    def is_overdue(self):
        """Check if invoice is overdue"""
        from django.utils import timezone
        return (
            self.status not in ['paid', 'cancelled'] and 
            self.due_date < timezone.now().date()
        )


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description = models.TextField()
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['id']

    def clean(self):
        """Validate item data"""
        if self.quantity <= 0:
            raise ValidationError("Quantity must be greater than 0")
        if self.unit_price < 0:
            raise ValidationError("Unit price cannot be negative")

    def save(self, *args, **kwargs):
        # Calculate amount (quantity is in minutes, unit_price is hourly rate)
        from decimal import Decimal, ROUND_HALF_UP
        hours = self.quantity / Decimal('60')
        self.amount = (hours * self.unit_price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.full_clean()
        super().save(*args, **kwargs)
        
    def __str__(self):
        return f"{self.description} - ${self.amount}"