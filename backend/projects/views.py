from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .serializers import ProjectSerializer, TimeEntrySerializer
from .models import Project, TimeEntry
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from payments.models import InvoiceItem, Invoice

User = get_user_model()

class ProjectPagination(PageNumberPagination):
   page_size = 12 # items per page
   page_size_query_param = 'page_size' # optional: allow client to override

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_project(request):
    serializer = ProjectSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project_list(request):
  projects = Project.objects.filter(user=request.user).order_by('due_date')  

  if request.query_params.get('paginate') == 'false':
        serializer = ProjectSerializer(projects, many=True)
        return Response({'projects': serializer.data, 'total': projects.count()})
  
  paginator = ProjectPagination()
  paginated_projects = paginator.paginate_queryset(projects, request)
  serializer = ProjectSerializer(paginated_projects, many=True)

  return Response({ 'projects' : serializer.data, 'total': projects.count()})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_project(request, pk):
    try:
        project = get_object_or_404(Project, pk=pk)
        serializer = ProjectSerializer(project)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            serializer.errors,
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_project_status(request, pk):
    try :
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response(
            {"error": "Project not found or you don't have permission to update it"},
            status=status.HTTP_404_NOT_FOUND
        )
    serializer = ProjectSerializer(project, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_clients_project_list(request, pk):
  projects = Project.objects.filter(user=request.user, client=pk)
  serializer = ProjectSerializer(projects, many=True)
  return Response({ 'projects' : serializer.data})

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def update_project(request, pk):
    try:
        project = Project.objects.get(pk=pk, user=request.user)
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
        project = Project.objects.get(pk=pk, user=request.user)
    except Project.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    project.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_projects_total(request):
   user = User.objects.get(id=request.user.id)
   return Response({'projectsTotal': len(user.projects.all()) })

#  TIME TRACKING VIEWS

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_time_entry(request):
    serializer = TimeEntrySerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)

@api_view([ "GET" ])
@permission_classes([IsAuthenticated])
def get_time_entries_list(request):
    time_entries = TimeEntry.objects.filter(user=request.user).order_by('created_at')
    serializer = TimeEntrySerializer(time_entries, many=True)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_time_entry_desc(request, pk):
    try:
        entry = TimeEntry.objects.get(pk=pk, user=request.user)
    except TimeEntry.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    entry.description = request.data.get("description", entry.description)
    entry.save(update_fields=["description"])

    return Response({"description": entry.description}, status=status.HTTP_200_OK)