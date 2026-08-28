from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text

from app.api.v1.api import api_router
from app.core.config import settings
from app.db.database import init_db, async_session
from app.models.User import UserRole
from app.schemas.AuthSchema import UserCreate
from app.utils.crud.auth import create_user, get_user_by_email

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
    from app import models

    await init_db()
    await _seed_superuser()
    yield


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
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
            allowed_hosts=settings.allowed_hosts_list,
        )

    # Response logging middleware (dev only)
    if settings.DEBUG:

        @app.middleware("http")
        async def log_responses(request: Request, call_next):
            response = await call_next(request)

            # Skip streaming responses (FileResponse, StreamingResponse, etc.)
            if "streaming" in response.__class__.__name__.lower():
                print(f"\n--- OUTGOING RESPONSE (STREAMING) ---")
                print(
                    f"Method: {request.method} | Path: {request.url.path} | Status: {response.status_code}\n"
                )
                return response

            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk

            print("\n--- OUTGOING RESPONSE ---")
            print(f"Method: {request.method} | Path: {request.url.path}")
            print(f"Status Code: {response.status_code}")
            try:
                print(f"Body: {response_body.decode('utf-8')}")
            except UnicodeDecodeError:
                print(f"Body: [Binary Data] ({len(response_body)} bytes)")
            print("-------------------------\n")

            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

    # -------------------------------------------------------------------
    # Routes
    # -------------------------------------------------------------------

    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["health"])
    async def health_check():
        # Basic liveness check
        health = {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

        # Readiness: verify DB connectivity
        try:
            async with async_session() as db:
                await db.execute(text("SELECT 1"))
            health["db"] = "connected"
        except Exception:
            health["db"] = "disconnected"
            health["status"] = "degraded"

        return health

    return app


app = create_app()
