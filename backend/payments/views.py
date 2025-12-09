import uuid
from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from .models import Invoice
from .utils.pdf_generator import generate_invoice_pdf
from django.contrib.auth import get_user_model

from rest_framework.decorators import api_view
from .serializers import InvoiceSerializer
from rest_framework.decorators import permission_classes

User = get_user_model()

@api_view([ "POST" ])
@permission_classes([IsAuthenticated])
def create_invoice(request):
    serializer = InvoiceSerializer(data=request.data)
    if serializer.is_valid():
        # Generate a unique invoice number BEFORE saving
        invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        invoice = serializer.save(freelancer=request.user, invoice_number=invoice_number)

        pdf_data = generate_invoice_pdf(invoice)
        response = HttpResponse(pdf_data, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'
        return response

    print("Serializer Errors:", serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_revenue(request):    
    try:
        user = User.objects.get(id=request.user.id)
        return Response({'revenue': user.revenue })
    
    except User.DoesNotExist:
        return Response({'detail': 'User not found'}, status=404)
    
    except Exception as e:
        return Response({'detail': 'Error occurred'}, status=400)