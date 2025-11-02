from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ClientSerializer
from .models import Client

@api_view([ "POST" ])
def create_client(request):
    serializer = ClientSerializer(data=request.data)
    if serializer.is_valid():
      serializer.save(freelancer=request.user)
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view([ "GET" ])
def get_client_list(request):
  clients = Client.objects.filter(freelancer=request.user)
  serializer = ClientSerializer(clients, many=True)
  return Response(serializer.data)