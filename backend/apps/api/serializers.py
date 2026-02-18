from rest_framework import serializers
from django.contrib.auth import get_user_model
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

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
  
class CustomRegisterSerializer(RegisterSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop('password2', None)

    def to_internal_value(self, data):
        if 'password_1' in data:
            data['password1'] = data.pop('password_1')
        return super().to_internal_value(data)

    def validate(self, data):
        if 'password_1' in data:
            data['password1'] = data.pop('password_1')
        data["password2"] = data.get("password1")
        return super().validate(data)