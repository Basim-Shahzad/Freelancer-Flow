from rest_framework import serializers
from .models import Project
from apps.clients.serializers import ClientSerializer


class ProjectSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Project._meta.get_field("client").remote_field.model.objects.all(),
        source="client",
        write_only=True,
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "due_date",
            "status",
            "total_time_spent",
            "hourly_rate",
            "fixed_rate",
            "client_id",
            "client",
            "created_at",
            "is_hourly_basis",
            "pricing_type",
        ]


class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "due_date",
            "status",
            "total_time_spent",
            "hourly_rate",
            "fixed_rate",
            "client_name",
            "created_at",
            "is_hourly_basis",
            "pricing_type",
        ]
