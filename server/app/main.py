from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.database import init_db, async_session

from app.models.User import UserRole
from app.schemas.AuthSchema import UserCreate
from app.utils.crud.auth import create_user, get_user_by_email
from app.db.database import async_session, init_db

# ---------------------------------------------------------------------------
# Startup — create tables + seed superuser
# ---------------------------------------------------------------------------


async def _seed_superuser() -> None:
    async with async_session() as db:
        existing = await get_user_by_email(db, settings.FIRST_SUPERUSER_EMAIL)
        if not existing:
            payload = UserCreate(
                email=settings.FIRST_SUPERUSER_EMAIL,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                full_name="Super Admin",
            )
            await create_user(db, payload, role=UserRole.ADMIN, is_verified=True)
            await db.commit()
            print(f"[startup] Superuser created: {settings.FIRST_SUPERUSER_EMAIL}")
        else:
            print(
                f"[startup] Superuser already exists: {settings.FIRST_SUPERUSER_EMAIL}"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models

    await init_db()
    await _seed_superuser()
    yield


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
    )

    # -------------------------------------------------------------------
    # Middleware
    # -------------------------------------------------------------------

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.is_production:
        # Reject requests with unexpected Host headers (HTTP host header injection)
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["yourdomain.com", "*.yourdomain.com"],
        )

    # -------------------------------------------------------------------
    # Routes
    # -------------------------------------------------------------------

    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["health"])
    def health_check():
        return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

    return app


app = create_app()
