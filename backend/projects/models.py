from django.db import models
from django.contrib.auth.models import User
from clients.models import Client

class Project(models.Model):
    freelancer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    payment = models.DecimalField(max_digits=15, decimal_places=2)

    def __str__(self):
        return f"{self.title} ({self.client.name})"
