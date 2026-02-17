from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id", 
            "username", 
            "email", 
            "date_joined",
            "logo",
            "phone",
            "tax_id",
            "business_name",
            "last_login",
            'revenue',
            'hourly_rate',
            'created_at'
        )

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"