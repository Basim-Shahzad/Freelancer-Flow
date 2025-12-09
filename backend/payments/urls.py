from django.urls import path
# from .views import InvoicePDFView
from .views import create_invoice, get_revenue

urlpatterns = [
    # path('<int:pk>/pdf/', InvoicePDFView.as_view(), name='invoice-pdf'),
    path('invoice/pdf/', create_invoice, name='create-invoice-pdf'),
    path('get-revenue/', get_revenue, name='get-revenue'),
]