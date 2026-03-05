from rest_framework import serializers
from .models import Project
from apps.projects.serializers import ProjectSerializer
from .models import TimeEntry


class TimeEntrySerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(), source="project", write_only=True
    )

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "description",
            "start_time",
            "end_time",
            "duration_minutes",
            "is_billable",
            "invoiced",
            "invoice",
            "updated_at",
            "project",
            "project_id",
            "created_at",
        ]


class TimeEntryListSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source="invoice.invoice_number", read_only=True
    )
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "description",
            "duration_minutes",
            "is_billable",
            "invoiced",
            "invoice_number",
            "project_name",
            "created_at",
        ]
