from django.urls import path, include
from . import views

urlpatterns = [
    path("clients/", views.ClientsListCreateApiView.as_view(), name="client_create_list"),
    path("clients/<uuid:id>/", views.ClientRetrieveUpdateDestroyApiView.as_view(), name="client_retrieve_update_destroy"),
]