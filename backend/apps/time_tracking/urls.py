from django.urls import path
from . import views

urlpatterns = [
   path('time-entries/', views.TimeEntriesListCreateApiView.as_view(), name='time_entries_list_create'),
   path('time-entries/<uuid:id>/', views.TimeEntryRetrieveUpdateDestroyApiView.as_view(), name='time_entry_detail'),
]
