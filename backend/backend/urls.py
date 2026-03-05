from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def home_view(request):
    return HttpResponse("Hello, this is Home Page")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home_view, name="home"),
    path("api/", include("apps.api.urls")),
    path("api/", include("apps.clients.urls")),
    path("api/", include("apps.invoices.urls")),
    path("api/", include("apps.projects.urls")),
    path("api/", include("apps.time_tracking.urls")),
    # This generates the actual schema file (JSON/YAML)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # These are the UIs that consume the schema above
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
