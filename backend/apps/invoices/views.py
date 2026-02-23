from rest_framework.decorators import api_view
from rest_framework import status
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Invoice
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view
from .serializers import InvoiceSerializer, InvoiceListSerializer
from rest_framework.decorators import permission_classes
from apps.projects.models import Project
from apps.clients.models import Client
from django.db import transaction
from rest_framework.pagination import PageNumberPagination


class InvoicePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "size"


User = get_user_model()


class InvoiceListCreateApiView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = InvoicePagination

    def get_serializer_class(self):
        """Use different serializers for list and create"""
        if self.request.method == "GET":
            return InvoiceListSerializer
        return InvoiceSerializer

    def get_queryset(self):
        queryset = (
            Invoice.objects.filter(user=self.request.user)
            .select_related("client", "project")
            .prefetch_related("items")
        )

        # Apply filters for GET requests
        if self.request.method == "GET":
            status = self.request.query_params.get("status")
            client_id = self.request.query_params.get("client_id")
            project_id = self.request.query_params.get("project_id")

            if status:
                queryset = queryset.filter(status=status)
            if client_id:
                queryset = queryset.filter(client_id=client_id)
            if project_id:
                queryset = queryset.filter(project_id=project_id)

        return queryset

    def perform_create(self, serializer):
        """Add user to the invoice data"""
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Handle POST request to create invoice"""
        # Add user_id to the data for validation
        data = request.data.copy()
        data["user_id"] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            self.perform_create(serializer)

        # Return the created invoice with all related data prefetched
        invoice = (
            Invoice.objects.select_related("client", "project")
            .prefetch_related("items")
            .get(id=serializer.instance.id)
        )

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        """Handle GET request to list invoices"""
        queryset = self.get_queryset()

        # Handle pagination parameter
        if request.query_params.get("paginate") == "false":
            serializer = self.get_serializer(queryset, many=True)
            return Response({"invoices": serializer.data, "count": queryset.count()})

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({"invoices": serializer.data})

        serializer = self.get_serializer(queryset, many=True)
        return Response({"invoices": serializer.data, "count": queryset.count()})


class InvoiceRetrieveUpdateDestroyApiView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "id"
    lookup_field = "id"

    def get_queryset(self):
        return (
            Invoice.objects.filter(user=self.request.user)
            .select_related("client", "project")
            .prefetch_related("items")
        )

    def destroy(self, request, *args, **kwargs):
        """Handle DELETE request to delete an invoice"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        """Handle PUT request to update an invoice"""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        # Add user_id to the data for validation
        data = request.data.copy()
        data["user_id"] = request.user.id

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            self.perform_update(serializer)

        # Return the updated invoice with all related data prefetched
        invoice = (
            Invoice.objects.select_related("client", "project")
            .prefetch_related("items")
            .get(id=serializer.instance.id)
        )

        return Response(InvoiceSerializer(invoice).data)
