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
            # Model Fields
            "id",
            "client",
            "client_id",
            "name",
            "description",
            "status",
            "due_date",
            "total_time_spent",
            "hourly_rate",
            "fixed_rate",
            "created_at",
            "updated_at",
            # Properties
            "is_hourly_basis",
            "pricing_type",
        ]


class ProjectsListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.name", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "due_date",
            "status",
            "total_time_spent",
            "hourly_rate",
            "fixed_rate",
            "client_name",
            "is_hourly_basis",
            "pricing_type",
            "created_at",
        ]


class NonPaginatedProjectsListSerializer(serializers.ModelSerializer):

    client_id = serializers.UUIDField(source="client.id", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "client_id",
            "status"
            "created_at",
        ]
