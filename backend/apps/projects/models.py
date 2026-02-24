from django.db import models
from apps.clients.models import Client
from django.utils import timezone
import uuid
from datetime import timedelta

def default_due_date():
    return timezone.now().date() + timedelta(days=30)

class Project(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("completed", "Completed"),
        ("archived", "Archived"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        "api.User", on_delete=models.CASCADE, related_name="projects"
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="active")
    due_date = models.DateField(default=default_due_date)

    # Time Related Fields
    total_time_spent = models.PositiveIntegerField(default=0)  # total time in minutes

    # Finance Related Fields ( Either Fixed or based on Hourly rate )
    hourly_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    fixed_rate = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_hourly_basis(self):
        """
        Checks if the project is billed on an hourly basis.
        Returns True if hourly_rate exists, False if fixed_rate exists.
        """
        # If hourly_rate is set, it's hourly.
        # If hourly_rate is None but fixed_rate exists, it's fixed.
        return self.hourly_rate is not None

    @property
    def pricing_type(self):
        """Returns a string representation of the pricing model."""
        return "Hourly" if self.is_hourly_basis else "Fixed Price"

    def get_time_total_spent(self):
        return sum(
            entry.duration_minutes
            for entry in self.time_entries.all()
            if entry.duration_minutes
        )

    def get_hourly_rate(self, user):
        return self.hourly_rate if self.hourly_rate is not None else user.hourly_rate

    def update_total_time(self):
        self.total_time = self.calculate_time_spent()
        super().save(update_fields=["total_time"])

    def __str__(self):
        return self.name
