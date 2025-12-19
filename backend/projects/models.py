from django.db import models
from clients.models import Client
from django.utils import timezone
from datetime import datetime, timedelta

def default_due_date():
    return timezone.now().date() + timedelta(days=30)

class Project(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('archived', 'Archived'),
    ]
    
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='projects')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(default=default_due_date)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='active')
    time_tracking = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def calculate_time_spent(self):
        if self.time_entries:
            entries = self.time_entries
            time_spent = 0
            for entry in entries:
                time_spent = time_spent + entry.duration_minutes
            return time_spent

    def save(self, *args, **kwargs):
        if self.hourly_rate and not self.time_tracking:
            self.time_tracking = True
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name

class TimeEntry(models.Model):
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='time_entries')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='time_entries')
    invoice = models.ForeignKey('payments.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='time_entries')
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    is_billable = models.BooleanField(default=True)
    invoiced = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = 'Time entries'
    
    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            duration = self.end_time - self.start_time
            self.duration_minutes = int(duration.total_seconds() / 60)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.project.name} - {self.start_time.date()}"