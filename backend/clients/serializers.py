from rest_framework import serializers
from .models import Client


class ClientSerializer(serializers.ModelSerializer):
  class Meta:
    model = Client
    fields = ["id", "name", "description", "created_at", "deadline", "payment"]
    read_only = ["freelancer"]