from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ClientSerializer
from .models import Client
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination

User = get_user_model()

class ClientPagination(PageNumberPagination):
   page_size = 8             # items per page
   page_size_query_param = 'page_size'  # optional: allow client to override

@api_view([ "POST" ])
@permission_classes([IsAuthenticated])
def create_client(request):
    serializer = ClientSerializer(data=request.data)
    if serializer.is_valid():
      serializer.save(user=request.user)
      return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_client(request, pk):
    try:
        client = get_object_or_404(Client, pk=pk)
        serializer = ClientSerializer(client)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            serializer.errors,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_client_list(request):
    clients = Client.objects.filter(user=request.user)
    serializer = ClientSerializer(clients, many=True)
    
    paginator = ClientPagination()
    paginated_clients = paginator.paginate_queryset(clients, request)
    
    serializer = ClientSerializer(paginated_clients, many=True)

    return Response({ 'clients' : serializer.data})
        
@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_client(request, pk):
    try:
        client = Client.objects.get(pk=pk, user=request.user)
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
        client = Client.objects.get(pk=pk, user=request.user)
    except Client.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    client.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_clients_total(request):
    try:
        user = User.objects.get(id=request.user.id)
        return Response({'clientsTotal': len(user.clients.all()) })
    
    except User.DoesNotExist:
        return Response({'detail': 'User not found'}, status=404)
    
    except Exception as e:
        return Response({'detail': 'Error occurred'}, status=400)