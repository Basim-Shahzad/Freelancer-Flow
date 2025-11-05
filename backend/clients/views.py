from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ClientSerializer
from .models import Client
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

@api_view([ "POST" ])
@permission_classes([IsAuthenticated])
def create_client(request):
    serializer = ClientSerializer(data=request.data)
    print(request.data)
    if serializer.is_valid():
      serializer.save(freelancer=request.user)
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_client_list(request):
  clients = Client.objects.filter(freelancer=request.user)
  serializer = ClientSerializer(clients, many=True)
  return Response(serializer.data)

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_client(request, pk):
    try:
        client = Client.objects.get(pk=pk, freelancer=request.user)
    except Client.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ClientSerializer(client, data=request.data, partial=(request.method == "PATCH"))
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_client(request, pk):
    try:
        client = Client.objects.get(pk=pk, freelancer=request.user)
    except Client.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    client.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)