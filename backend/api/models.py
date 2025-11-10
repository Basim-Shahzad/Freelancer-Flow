from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
   business_name = models.CharField(max_length=255, blank=True)
   phone = models.CharField(max_length=50, blank=True)
   tax_id = models.CharField(max_length=100, blank=True)
   logo = models.ImageField(upload_to='logos/', blank=True, null=True)
       
   def __str__(self):
      return self.email