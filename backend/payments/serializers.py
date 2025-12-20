from rest_framework import serializers
from .models import Invoice
from projects.serializers import ProjectSerializer
from projects.models import Project

from clients.serializers import ClientSerializer
from clients.models import Client

class InvoiceSerializer(serializers.ModelSerializer):
   project = ProjectSerializer(read_only=True)
   project_id = serializers.PrimaryKeyRelatedField(
         queryset=Project.objects.all(),
         source='project',
         write_only=True
   )

   client = ClientSerializer(read_only=True)
   client_id = serializers.PrimaryKeyRelatedField(
         queryset=Client.objects.all(),
         source='client',
         write_only=True
   )

   class Meta:
      model = Invoice
      fields = [ "id", "client", "project", "issue_date", "due_date", "description", "payment", "status", "payment_date", "notes", "created_at", "updated_at" ]
      read_only = ["freelancer", "invoice_number"]