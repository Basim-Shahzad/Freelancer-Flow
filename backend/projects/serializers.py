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
            "id", "title", "description", "start_date", "due_date",
            "is_completed", "client", "client_id", "freelancer", "payment"
        ]
        read_only_fields = ["freelancer"]
