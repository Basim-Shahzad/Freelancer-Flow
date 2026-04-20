from rest_framework import serializers
from .models import Invoice, InvoiceItem
from .services import mark_invoice_paid, mark_invoice_unpaid
from apps.clients.models import Client
from apps.projects.models import Project
from django.db import transaction
from django.contrib.auth import get_user_model
from apps.clients.serializers import ClientSerializer
from apps.projects.serializers import ProjectSerializer
from decimal import Decimal, ROUND_HALF_UP

User = get_user_model()

class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice items"""

    class Meta:
        model = InvoiceItem
        fields = ["id", "description", "quantity", "unit_price", "amount", "created_at"]
        read_only_fields = ["id", "amount", "created_at"]

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

    items = InvoiceItemSerializer(many=True, required=False)

    # Foreign key fields for writing
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
        required=False,
    )
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source="client",
        write_only=True,
        required=False,
    )
    project_id = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all(),
        source="project",
        write_only=True,
        allow_null=True,
        required=False,
    )

    # Read-only nested objects with full details
    client = ClientSerializer(read_only=True)
    project = ProjectSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "user_id",
            "client_id",
            "project_id",
            "client",  # Full nested object of Client
            "project",  # Full nested object of Project
            "invoice_number",
            "is_overdue",
            "is_hourly_basis",
            "issue_date",
            "due_date",
            "status",
            "subtotal",
            "tax_rate",
            "tax_amount",
            "total",
            "notes",
            "payment_date",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "invoice_number",
            "tax_amount",
            "total",
            "created_at",
            "updated_at",
            "client",
            "project",
        ]

    def validate(self, data):
        """Validate invoice data"""
        is_partial = self.partial if hasattr(self, "partial") else False

        invoice_items_data = data.get("items", [])

        # For creation (not partial update and not updating existing), require items
        if not is_partial and not self.instance:
            if not invoice_items_data:
                raise serializers.ValidationError(
                    {"items": "Invoice must have at least one item"}
                )

        # Only validate subtotal if items are provided
        if invoice_items_data:
            # Determine if this is an hourly project
            project = data.get("project") or (
                self.instance.project if self.instance else None
            )
            is_hourly = project.is_hourly_basis if project else False

            calculated_subtotal = sum(
                (
                    (
                        (Decimal(str(item["quantity"])) / Decimal("60"))
                        * Decimal(str(item.get("unit_price") or project.hourly_rate))
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    if is_hourly
                    else (
                        Decimal(str(item["quantity"]))
                        * Decimal(str(item["unit_price"]))
                    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                )
                for item in invoice_items_data
            )

            provided_subtotal = data.get("subtotal", Decimal("0"))

            # Allow small rounding differences (0.01)
            if abs(calculated_subtotal - provided_subtotal) > Decimal("0.01"):
                raise serializers.ValidationError(
                    {
                        "subtotal": f"Subtotal ${provided_subtotal} does not match calculated total ${calculated_subtotal}"
                    }
                )

        # Validate dates only if both are provided
        issue_date = data.get("issue_date")
        due_date = data.get("due_date")

        # For partial updates, also check existing values
        if is_partial and self.instance:
            issue_date = issue_date or self.instance.issue_date
            due_date = due_date or self.instance.due_date

        if issue_date and due_date and due_date < issue_date:
            raise serializers.ValidationError(
                {"due_date": "Due date cannot be before issue date"}
            )

        # Validate payment date for paid invoices
        status_value = data.get("status")
        payment_date = data.get("payment_date")

        if is_partial and self.instance:
            payment_date = payment_date or self.instance.payment_date

        if status_value == "paid" and not payment_date:
            raise serializers.ValidationError(
                {"payment_date": "Payment date is required for paid invoices"}
            )

        # Validate project belongs to client (only if both are provided)
        project = data.get("project")
        client = data.get("client")

        if project and client and project.client_id != client.id:
            raise serializers.ValidationError(
                {"project_id": "Project does not belong to the selected client"}
            )

        return data

    def create(self, validated_data):
        """Create invoice with items"""
        invoice_items_data = validated_data.pop("items", [])

        with transaction.atomic():
            invoice = Invoice.objects.create(**validated_data)

            for item_data in invoice_items_data:
                InvoiceItem.objects.create(invoice=invoice, **item_data)

        return invoice

    def update(self, instance, validated_data):
        """Update invoice and optionally replace items"""
        invoice_items_data = validated_data.pop("items", None)
        new_status = validated_data.get("status")

        with transaction.atomic():
            if new_status == "paid" and instance.status != "paid":
                # Pop fields the service will handle
                payment_date = validated_data.pop("payment_date", None)
                validated_data.pop("status", None)

                # Apply any other field changes first
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()

                instance = mark_invoice_paid(instance, payment_date=payment_date)

            elif (
                new_status is not None
                and new_status != "paid"
                and instance.status == "paid"
            ):
                # Transitioning away from paid — reverse the revenue effect
                validated_data.pop("status", None)

                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()

                instance = mark_invoice_unpaid(instance)

            else:
                # Normal update, no paid status transition
                for attr, value in validated_data.items():
                    setattr(instance, attr, value)
                instance.save()

            # Replace items if provided
            if invoice_items_data is not None:
                instance.items.all().delete()
                for item_data in invoice_items_data:
                    InvoiceItem.objects.create(invoice=instance, **item_data)

        return instance


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for invoice lists"""

    client_name = serializers.CharField(source="client.name", read_only=True)
    project_name = serializers.CharField(
        source="project.name", read_only=True, allow_null=True
    )
    items_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "client_name",
            "project_name",
            "issue_date",
            "due_date",
            "is_overdue",
            "status",
            "total",
            "items_count",
            "created_at",
        ]
