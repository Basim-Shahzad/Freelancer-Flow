from django.urls import path
from . import views

urlpatterns = [
    path('invoices/', views.list_invoices, name='list_invoices'),
    path('invoices/create/', views.create_invoice, name='create_invoice'),
    path('invoices/<int:invoice_id>/', views.get_invoice, name='get_invoice'),
    path('invoices/<int:invoice_id>/update/', views.update_invoice, name='update_invoice'),
    path('invoices/<int:invoice_id>/delete/', views.delete_invoice, name='delete_invoice'),
]