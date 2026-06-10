from django.urls import path
from . import views

urlpatterns = [
   path('projects/', views.ProjectsListCreateApiView.as_view(), name='projects_list_create'),
   path('projects/<uuid:id>/', views.ProjectRetrieveUpdateDestroyApiView.as_view(), name='projects_detail'),
]
