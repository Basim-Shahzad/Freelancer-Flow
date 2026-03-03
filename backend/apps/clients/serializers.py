from rest_framework import serializers
from .models import Client
from apps.projects.models import Project

class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "name",
            "email",
            "phone",
            "company",
            "address",
            "tax_id",
            "notes",
            "created_at",
            "updated_at",
        ]

class ProjectNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name"]

class ClientListSerializer(serializers.ModelSerializer):
    projects = ProjectNameSerializer(many=True, read_only=True)

    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "created_at",
            "projects"
        ]

class NonPaginatedClientListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            "id",
            "name",
            "created_at",
        ]
