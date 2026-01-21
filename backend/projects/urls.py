from django.urls import path
from .views import create_project, delete_project, update_project, get_clients_project_list, get_project_list, get_projects_total, get_project, update_project_status, create_time_entry, get_time_entries_list, update_time_entry_desc

urlpatterns = [
    path("create-project/", create_project, name="create-project"),
    path("projects/", get_project_list, name="project-list"),
    path("projects/<int:pk>/", get_project, name="project"),
    path("projects-total/", get_projects_total, name="projects-total"),
    # path("projects/<int:pk>", get_clients_project_list, name="project-client-list"),
    path("projects/<int:pk>/update/", update_project, name="update-project"),
    path("projects/<int:pk>/status/", update_project_status, name="update-project-status"),
    path("projects/<int:pk>/delete/", delete_project, name="delete-project"),


    # TIME TRACKING URLS
    path("time-entries/", get_time_entries_list, name="time-entries-list"),
    path("create-time-entry/", create_time_entry, name="create-time-entry"),
    path("time-entries/<int:pk>/update", update_time_entry_desc),

]