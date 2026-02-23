from django.urls import path
from . import views

urlpatterns = [
   path('invoices/', views.InvoiceListCreateApiView.as_view(), name='invoice_list_create'),
   path('invoices/<uuid:id>/', views.InvoiceRetrieveUpdateDestroyApiView.as_view(), name='invoice_detail'),
]