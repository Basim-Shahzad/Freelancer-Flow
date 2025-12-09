from django.contrib.auth.models import AbstractUser
from django.db import models
from projects.models import Project
from django.contrib.auth import get_user_model

class User(AbstractUser):
   business_name = models.CharField(max_length=255, blank=True)
   phone = models.CharField(max_length=50, blank=True)
   tax_id = models.CharField(max_length=100, blank=True)
   logo = models.ImageField(upload_to='logos/', blank=True, null=True)
   revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)

   def __str__(self):
      return self.email