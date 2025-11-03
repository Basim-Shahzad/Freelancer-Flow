from django.urls import path
from .views import create_project, delete_project, update_project, get_client_project_list, get_project_list

urlpatterns = [
    path("create-project/", create_project, name="create-project"),
    path("projects/", get_project_list, name="project-list"),
    path("projects/<int:pk>", get_client_project_list, name="project-client-list"),
    path("projects/<int:pk>/update/", update_project, name="update-project"),
    path("projects/<int:pk>/delete/", delete_project, name="delete-project"),
]