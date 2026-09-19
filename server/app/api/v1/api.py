from fastapi.routing import APIRouter
from app.api.v1.endpoints import (
    activity,
    auth,
    change_requests,
    client_portal,
    clients,
    expenses,
    invoices,
    milestones,
    payments,
    profile,
    projects,
    time_entries,
    vat,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(profile.router)
api_router.include_router(clients.router)
api_router.include_router(projects.router)
api_router.include_router(time_entries.router)
api_router.include_router(milestones.router)
api_router.include_router(change_requests.router)
api_router.include_router(invoices.router)
api_router.include_router(payments.router)
api_router.include_router(expenses.router)
api_router.include_router(vat.router)
api_router.include_router(activity.router)
api_router.include_router(client_portal.router)
