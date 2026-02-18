from django.urls import path, include
from .views import create_client, get_client_list, update_client, delete_client, get_clients_total

urlpatterns = [
    path("create-client/", create_client, name="create-client"),
    path("clients/", get_client_list, name="client-list"),
    path("clients-total/", get_clients_total, name="client-total"),
    path("clients/<int:pk>/update/", update_client, name="update-client"),
    path("clients/<int:pk>/delete/", delete_client, name="delete-client"),
]