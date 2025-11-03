from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ProjectSerializer
from .models import Project
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project(request):
    serializer = ProjectSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(freelancer=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_project_list(request):
  projects = Project.objects.filter(freelancer=request.user)
  serializer = ProjectSerializer(projects, many=True)
  return Response(serializer.data)

@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_client_project_list(request, pk):
  projects = Project.objects.filter(freelancer=request.user, client=pk)
  serializer = ProjectSerializer(projects, many=True)
  return Response(serializer.data)

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_project(request, pk):
    try:
        project = Project.objects.get(pk=pk, freelancer=request.user)
    except Project.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectSerializer(project, data=request.data, partial=(request.method == "PATCH"))
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_project(request, pk):
    try:
        project = Project.objects.get(pk=pk, freelancer=request.user)
    except Project.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    project.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)