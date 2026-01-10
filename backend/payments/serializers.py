from rest_framework import serializers
from .models import Invoice, InvoiceItem
from clients.models import Client
from projects.models import Project
from django.db import transaction
from api.models import User
from decimal import Decimal


class ClientSerializer(serializers.ModelSerializer):
    """Serializer for full client details"""
    class Meta:
        model = Client
        fields = '__all__'  # Or specify: ['id', 'name', 'email', 'phone', 'address', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for full project details"""
    class Meta:
        model = Project
        fields = '__all__'  # Or specify: ['id', 'name', 'description', 'client', 'hourly_rate', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice items"""
    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'amount', 'created_at']
        read_only_fields = ['id', 'amount', 'created_at']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price cannot be negative")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices with nested items"""
    
    # Read-only nested items
    items = InvoiceItemSerializer(many=True, read_only=True)
    
    # Write-only items for creation
    invoice_items = InvoiceItemSerializer(many=True, write_only=True, required=False)
    
    # Foreign key fields for writing
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='user',
        write_only=True,
        required=False  # Make optional for partial updates
    )
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source='client',
        write_only=True,
        required=False  # Make optional for partial updates
    )
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source='project',
        write_only=True,
        allow_null=True,
        required=False
    )
    
    # Read-only nested objects with full details
    client = ClientSerializer(read_only=True)
    project = ProjectSerializer(read_only=True, allow_null=True)
    
    # Keep the simple names for backward compatibility (optional)
    client_name = serializers.CharField(source='client.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'user_id', 'client_id', 'project_id',
            'client', 'project',  # Full nested objects
            'client_name', 'project_name',  # Simple names for compatibility
            'invoice_number', 'issue_date', 'due_date', 'status', 
            'subtotal', 'tax_rate', 'tax_amount', 'total', 
            'notes', 'payment_date', 'created_at', 'updated_at',
            'items', 'invoice_items', 'is_overdue'
        ]
        read_only_fields = [
            'id', 'invoice_number', 'tax_amount', 'total',
            'created_at', 'updated_at', 'is_overdue', 'client', 'project'
        ]

    def validate(self, data):
        """Validate invoice data"""
        # Check if this is a partial update (PATCH)
        is_partial = self.partial if hasattr(self, 'partial') else False
        
        # Only validate items for creation or full updates
        invoice_items = data.get('invoice_items', [])
        
        # For creation (not partial update and not updating existing), require items
        if not is_partial and not self.instance:
            if not invoice_items:
                raise serializers.ValidationError({
                    'invoice_items': 'Invoice must have at least one item'
                })
        
        # Only validate subtotal if items are provided
        if invoice_items:
            # Calculate expected subtotal (quantity is in MINUTES, convert to hours)
            from decimal import Decimal, ROUND_HALF_UP
            calculated_subtotal = sum(
                ((Decimal(str(item['quantity'])) / Decimal('60')) * Decimal(str(item['unit_price']))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                for item in invoice_items
            )
            
            provided_subtotal = data.get('subtotal', Decimal('0'))
            
            # Allow small rounding differences (0.01)
            if abs(calculated_subtotal - provided_subtotal) > Decimal('0.01'):
                raise serializers.ValidationError({
                    'subtotal': f'Subtotal ${provided_subtotal} does not match calculated total ${calculated_subtotal}'
                })

        # Validate dates only if both are provided
        issue_date = data.get('issue_date')
        due_date = data.get('due_date')
        
        # For partial updates, also check existing values
        if is_partial and self.instance:
            issue_date = issue_date or self.instance.issue_date
            due_date = due_date or self.instance.due_date
        
        if issue_date and due_date and due_date < issue_date:
            raise serializers.ValidationError({
                'due_date': 'Due date cannot be before issue date'
            })

        # Validate payment date for paid invoices
        status_value = data.get('status')
        payment_date = data.get('payment_date')
        
        if status_value == 'paid' and not payment_date:
            raise serializers.ValidationError({
                'payment_date': 'Payment date is required for paid invoices'
            })

        # Validate project belongs to client (only if both are provided)
        project = data.get('project')
        client = data.get('client')
        
        if project and client and project.client_id != client.id:
            raise serializers.ValidationError({
                'project_id': 'Project does not belong to the selected client'
            })

        return data

    def create(self, validated_data):
        """Create invoice with items"""
        invoice_items_data = validated_data.pop('invoice_items')
        
        with transaction.atomic():
            # Create invoice
            invoice = Invoice.objects.create(**validated_data)
            
            # Create invoice items
            for item_data in invoice_items_data:
                InvoiceItem.objects.create(invoice=invoice, **item_data)
        
        return invoice

    def update(self, instance, validated_data):
        """Update invoice and optionally items"""
        invoice_items_data = validated_data.pop('invoice_items', None)
        
        with transaction.atomic():
            # Update invoice fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            
            # Update items if provided
            if invoice_items_data is not None:
                # Delete existing items
                instance.items.all().delete()
                
                # Create new items
                for item_data in invoice_items_data:
                    InvoiceItem.objects.create(invoice=instance, **item_data)
        
        return instance


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for invoice lists"""
    client_name = serializers.CharField(source='client.name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'client_name', 'project_name',
            'issue_date', 'due_date', 'status', 'total', 
            'items_count', 'is_overdue', 'created_at'
        ]