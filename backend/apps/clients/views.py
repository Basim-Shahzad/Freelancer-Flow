from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import generics
from .serializers import ClientSerializer, ClientListSerializer
from .models import Client
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.pagination import PageNumberPagination

User = get_user_model()


class ClientPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"


class ClientsListCreateApiView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = ClientPagination

    def get_serializer_class(self):
        """Use different serializers for list and create"""
        if self.request.method == "GET":
            return ClientListSerializer
        return ClientSerializer

    def get_queryset(self):
        queryset = Client.objects.filter(user=self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Handle POST request to create client"""
        # Add user_id to the data for validation
        data = request.data.copy()
        data["user_id"] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            self.perform_create(serializer)

        # Return the created client with all related data prefetched
        client = Client.objects.get(id=serializer.instance.id)

        return Response(ClientSerializer(client).data, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        """Handle GET request to list clients"""
        queryset = self.get_queryset()

        # Handle pagination parameter
        if request.query_params.get("paginate") == "false":
            serializer = self.get_serializer(queryset, many=True)
            return Response({"clients": serializer.data, "count": queryset.count()})

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({"clients": serializer.data})

        serializer = self.get_serializer(queryset, many=True)
        return Response({"clients": serializer.data, "count": queryset.count()})


class ClientRetrieveUpdateDestroyApiView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "id"
    lookup_field = "id"

    def get_queryset(self):
        return Client.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """Handle DELETE request to delete a Client"""
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        """Handle PUT request to update a Client"""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        # Add user_id to the data for validation
        data = request.data.copy()
        data["user_id"] = request.user.id

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            self.perform_update(serializer)

        # Return the updated client with all related data prefetched
        client = Client.objects.get(id=serializer.instance.id)

        return Response(ClientSerializer(client).data)