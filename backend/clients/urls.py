# project/urls.py
from django.urls import path, include
from .views import create_client, get_client_list

urlpatterns = [
    path("create-client/", create_client, name="create-client"),
    path("clients/", get_client_list, name="client-list")
]