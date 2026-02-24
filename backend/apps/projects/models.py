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

    # Finance Related Fields
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
        return self.hourly_rate is not None

    @property
    def pricing_type(self):
        return "Hourly" if self.is_hourly_basis else "Fixed Price"

    def get_time_total_spent(self):
        """Sums duration from related time entries."""
        # Using .aggregate is more efficient than a Python loop for large datasets
        return (
            self.time_entries.aggregate(total=models.Sum("duration_minutes"))["total"]
            or 0
        )

    def get_hourly_rate(self, user):
        return self.hourly_rate if self.hourly_rate is not None else user.hourly_rate

    def update_total_time(self):
        """Syncs the total_time_spent field with the actual sum of entries."""
        self.total_time_spent = self.get_time_total_spent()
        self.save(update_fields=["total_time_spent"])

    def __str__(self):
        return self.name
