from rest_framework import serializers
from .models import Client


class ClientSerializer(serializers.ModelSerializer):
  class Meta:
    model = Client
    fields = [ "id", "name", "notes", "created_at", "email", "phone", "company", "tax_id" ]
    read_only = ["user"]