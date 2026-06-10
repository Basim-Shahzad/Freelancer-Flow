from django.db import models
from apps.projects.models import Project
import uuid

# Create your models here.


class TimeEntry(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        "api.User", on_delete=models.CASCADE, related_name="time_entries"
    )
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="time_entries"
    )

    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    # Invoice Related Fields
    invoiced = models.BooleanField(default=False)
    is_billable = models.BooleanField(default=True)
    invoice = models.ForeignKey(
        "invoices.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="time_entries",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time and self.end_time > self.start_time:
            self.duration_minutes = int(
                (self.end_time - self.start_time).total_seconds() / 60
            )
        super().save(*args, **kwargs)
        if self.project:
            self.project.update_total_time()

    def __str__(self):
        return f"{self.project.name} - {self.description} - {self.duration_minutes}"
