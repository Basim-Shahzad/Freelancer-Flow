from django.contrib.auth.base_user import BaseUserManager


class CustomUserManager(BaseUserManager):
    """
    Custom manager for User model where email is the unique identifier.
    """

    def create_user(self, email, password, username=None, **extra_fields):
        """
        Creates and saves a User with the given email, password, and optional username.
        """
        if not email:
            raise ValueError("The Email must be set")

        email = self.normalize_email(email)

        if not username:
            username = email.split("@")[0]

        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password, username=None, **extra_fields):
        """
        Creates and saves a SuperUser with is_staff and is_superuser set to True.
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, username=username, **extra_fields)
