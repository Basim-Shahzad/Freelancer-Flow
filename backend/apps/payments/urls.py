from django.urls import path
from . import views

urlpatterns = [
    path('get-revenue/', views.get_revenue , name='get_revenue'),
    path('invoices/', views.InvoiceListCreateView.as_view(), name='invoice_list_create'),
    path('invoices/<int:invoice_id>/', views.InvoiceDetailView.as_view(), name='invoice_detail'),
]