from rest_framework import serializers
from .models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
  class Meta:
    model = Invoice
    fields = [ "id", "client", "project", "issue_date", "due_date", "description", "payment", "status", "payment_date", "notes", "created_at", "updated_at" ]
    read_only = ["freelancer", "invoice_number"]