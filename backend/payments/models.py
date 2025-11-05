from django.db import models
from clients.models import Client
from projects.models import Project
from django.contrib.auth.models import User

class Invoice(models.Model):
    freelancer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="invoices",
        help_text="Freelancer who issued the invoice."
    )
    client = models.ForeignKey(
         Client,
        on_delete=models.CASCADE,
        related_name="invoices",
        help_text="Client who receives the invoice."
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
        help_text="Optional project this invoice is linked to."
    )

    invoice_number = models.CharField(max_length=20, unique=True)
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    description = models.TextField(blank=True, help_text="Summary of work or services billed.")
    payment = models.DecimalField(max_digits=10, decimal_places=2)

    status = models.CharField(
        max_length=10,
        choices=[
            ('draft', 'Draft'),
            ('pending', 'Pending'),
            ('paid', 'Paid'),
            ('overdue', 'Overdue'),
            ('cancelled', 'Cancelled'),
        ],
        default='draft'
    )

    payment_date = models.DateField(null=True, blank=True, help_text="Date the invoice was paid.")
    notes = models.TextField(blank=True, help_text="Internal notes or comments.")

    created_at = models.DateTimeField(auto_now_add=True )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.client.name}"