from rest_framework import serializers
from django.contrib.auth import get_user_model
from dj_rest_auth.registration.serializers import RegisterSerializer

User = get_user_model()


class CustomUserSerializer(serializers.ModelSerializer):
    """
    Serializer for the Custom User model including business-specific metadata.
    """

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
            "revenue",
            "hourly_rate",
            "created_at",
        )
        read_only_fields = ("id", "date_joined", "last_login", "created_at")


class CustomRegisterSerializer(RegisterSerializer):
    """
    Production-ready registration serializer handling camelCase overrides
    and single-password requirements.
    """

    # Explicitly define password1 to override default behavior and avoid 'required' errors
    password1 = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove password2 requirement for single-field password entry
        if "password2" in self.fields:
            self.fields.pop("password2", None)

    def to_internal_value(self, data):
        """
        Intercept data before validation to map frontend 'password_1'
        to the expected 'password1' key.
        """
        # If frontend sends password_1 (snake) or password1 (camel), normalize it
        password = data.get("password_1") or data.get("password1")
        if password:
            data["password1"] = password
            data["password2"] = password
        return super().to_internal_value(data)

    def validate(self, data):
        """
        Ensure password2 exists for the parent RegisterSerializer.validate logic.
        """
        if "password1" in data:
            data["password2"] = data.get("password1")
        return super().validate(data)
