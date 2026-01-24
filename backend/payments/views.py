from rest_framework.decorators import api_view
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from .models import Invoice
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from .serializers import InvoiceSerializer, InvoiceItemSerializer
from rest_framework.decorators import permission_classes
from .utils import render_pdf
from projects.models import Project, TimeEntry
from django.db.models import Sum
from clients.models import Client
from django.db import transaction
from rest_framework.pagination import PageNumberPagination

class InvoicePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "size"

User = get_user_model()

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_revenue(request):
    """Get confirmed revenue (paid invoices) for the authenticated user"""
    user = request.user

    try:
        # aggregate returns a dict: {'total_paid': Decimal('xxx.xx')} or None
        result = Invoice.objects.filter(
            user=user, 
            status='paid'
        ).aggregate(
            total_paid=Sum('total')
        )

        # If no invoices exist, result['total_paid'] will be None. 
        # Default to 0.00 for a consistent API response.
        total_revenue = result.get('total_paid') or 0

        return Response(
                float(total_revenue),
                status=status.HTTP_201_CREATED
        )
        
    except Exception as e:
        return Response({
            "success": False,
            "error": "An unexpected error occurred."
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_invoice(request):
    """Create a new invoice with items"""
    user = request.user
    
    try:
        # Get and validate data
        data = request.data.copy()
        
        # Add user_id to data
        data['user_id'] = user.id
        
        # Validate client and project belong to user
        client_id = data.get('client_id')
        project_id = data.get('project_id')
        
        if not client_id:
            return Response(
                {'error': 'client_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if client exists and belongs to user
        if not Client.objects.filter(user=user, id=client_id).exists():
            return Response(
                {'error': 'Client not found or does not belong to you'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if project exists and belongs to user (if provided)
        if project_id:
            try:
                project = Project.objects.get(user=user, id=project_id)
                
                # Verify project belongs to the client
                if project.client_id != int(client_id):
                    return Response(
                        {'error': 'Project does not belong to the selected client'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Project.DoesNotExist:
                return Response(
                    {'error': 'Project not found or does not belong to you'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Calculate subtotal from items if not provided
        invoice_items = data.get('invoice_items', [])
        if not invoice_items:
            return Response(
                {'error': 'Invoice must have at least one item'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate subtotal with proper rounding
        from decimal import Decimal, ROUND_HALF_UP
        calculated_subtotal = Decimal('0')
        
        for item in invoice_items:
            quantity = Decimal(str(item['quantity']))
            unit_price = Decimal(str(item['unit_price']))
            
            # Convert minutes to hours and calculate amount
            hours = quantity / Decimal('60')
            item_amount = (hours * unit_price).quantize(
                Decimal('0.01'), 
                rounding=ROUND_HALF_UP
            )
            calculated_subtotal += item_amount
        
        # Round the final subtotal to 2 decimal places
        calculated_subtotal = calculated_subtotal.quantize(
            Decimal('0.01'), 
            rounding=ROUND_HALF_UP
        )
        
        # Set subtotal - convert to string to preserve precision
        data['subtotal'] = str(calculated_subtotal)
        
        # Serialize and validate
        serializer = InvoiceSerializer(data=data)
        
        if serializer.is_valid():
            # Create invoice with transaction
            with transaction.atomic():
                invoice = serializer.save()
            
            # Return created invoice
            return Response(
                InvoiceSerializer(invoice).data,
                status=status.HTTP_201_CREATED
            )
        else:
            print(serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except Exception as e:
        print(e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_invoices(request):
    user = request.user

    status = request.query_params.get("status")
    client_id = request.query_params.get("client_id")
    project_id = request.query_params.get("project_id")

    invoices = Invoice.objects.filter(user=user)

    if status:
        invoices = invoices.filter(status=status)

    if client_id:
        invoices = invoices.filter(client_id=client_id)

    if project_id:
        invoices = invoices.filter(project_id=project_id)

    from .serializers import InvoiceListSerializer

    if request.query_params.get("paginate") == "false":
        serializer = InvoiceListSerializer(invoices, many=True)
        return Response({
            "invoices": serializer.data,
            "total": invoices.count()
        })

    paginator = InvoicePagination()  # page_size = 10
    paginated_invoices = paginator.paginate_queryset(invoices, request)
    serializer = InvoiceListSerializer(paginated_invoices, many=True)

    return Response({
        "invoices": serializer.data,
        "total": invoices.count()
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_invoice(request, invoice_id):
    """Get a single invoice by ID"""
    user = request.user
    
    try:
        # Use select_related to fetch related objects in a single query
        invoice = Invoice.objects.select_related('client', 'project').prefetch_related('items').get(
            id=invoice_id,
            user=user
        )
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)
    except Invoice.DoesNotExist:
        return Response(
            {'error': 'Invoice not found'},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_invoice(request, invoice_id):
    """Update an existing invoice"""
    user = request.user
    
    try:
        invoice = Invoice.objects.get(id=invoice_id, user=user)
        
        # Allow status changes, but prevent editing other fields for paid/cancelled invoices
        if invoice.status in ['paid', 'cancelled']:
            # Only allow updating status and payment_date for paid/cancelled invoices
            allowed_fields = {'status', 'payment_date', 'notes'}
            incoming_fields = set(request.data.keys())
            
            if not incoming_fields.issubset(allowed_fields):
                return Response(
                    {'error': f'Cannot update {invoice.status} invoices. Only status, payment_date, and notes can be modified.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        data = request.data.copy()
        print(data)

        # Ensure user_id stays the same
        data['user_id'] = user.id
        
        partial = request.method == 'PATCH'
        serializer = InvoiceSerializer(invoice, data=data, partial=partial)
        
        if serializer.is_valid():
            with transaction.atomic():
                invoice = serializer.save()
            
            return Response(
                InvoiceSerializer(invoice).data,
                status=status.HTTP_200_OK
            )
        else:
            print(serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except Invoice.DoesNotExist:
        return Response(
            {'error': 'Invoice not found'},
            status=status.HTTP_404_NOT_FOUND
        )

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_invoice(request, invoice_id):
    """Delete an invoice (only drafts can be deleted)"""
    user = request.user
    
    try:
        invoice = Invoice.objects.get(id=invoice_id, user=user)
        
        # Only allow deleting draft invoices
        if invoice.status != 'draft':
            return Response(
                {'error': 'Only draft invoices can be deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.delete()
        
        return Response(
            {'message': 'Invoice deleted successfully'},
            status=status.HTTP_204_NO_CONTENT
        )
        
    except Invoice.DoesNotExist:
        return Response(
            {'error': 'Invoice not found'},
            status=status.HTTP_404_NOT_FOUND
        )