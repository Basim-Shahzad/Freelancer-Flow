from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.auth import get_user_model

class User(AbstractUser):

   USERNAME_FIELD = "email"

   email = models.EmailField(unique=True)

   REQUIRED_FIELDS = []

   hourly_rate = models.DecimalField(max_digits=12, decimal_places=2, default=20)
   business_name = models.CharField(max_length=255, blank=True)
   phone = models.CharField(max_length=50, blank=True)
   tax_id = models.CharField(max_length=100, blank=True)
   logo = models.ImageField(upload_to='logos/', blank=True, null=True)
   revenue = models.DecimalField(max_digits=10, decimal_places=2, default=0)
   created_at = models.DateTimeField(auto_now_add=True)
   
   def __str__(self):
      return self.username