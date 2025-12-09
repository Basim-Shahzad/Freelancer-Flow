from rest_framework import serializers
from .models import Project
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
            "id", "name", "description", "created_at", "due_date", "price", "status", "updated_at", "hourly_rate", 'client_id', 'client', 'time_tracking'
        ]