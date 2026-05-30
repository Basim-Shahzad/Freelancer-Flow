from fastapi.routing import APIRouter
from app.api.v1.endpoints import auth, clients, projects

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(clients.router)
api_router.include_router(projects.router)
