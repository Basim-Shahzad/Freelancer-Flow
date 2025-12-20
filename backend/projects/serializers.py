from rest_framework import serializers
from .models import Project, TimeEntry
from clients.serializers import ClientSerializer

class ProjectSerializer(serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Project._meta.get_field('client').remote_field.model.objects.all(),
        source='client',
        write_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id", "name", "description", "created_at", "due_date", "total_time", "status", "updated_at", "hourly_rate", 'client_id', 'client', 'time_tracking'
        ]
        
class TimeEntrySerializer(serializers.ModelSerializer):
    project = ProjectSerializer(read_only=True)
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source='project',
        write_only=True
    )

    class Meta:
        model = TimeEntry
        fields = [
            "id", "description", "created_at", "start_time", "end_time", 
            "duration_minutes", "is_billable", "invoiced", 'invoice', 
            'updated_at', 'project', 'project_id'
        ]