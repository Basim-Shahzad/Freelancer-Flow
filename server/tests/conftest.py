"""
Shared pytest fixtures.

IMPORTANT: environment variables must be set before `app.core.config` (and
therefore `app.main`, `app.db.database`, ...) is imported anywhere, because
`Settings` is instantiated once at import time as a module-level singleton
(`settings = get_settings()`). The app's own DATABASE_URL is a fake,
never-connected-to value; tests use a separate Postgres database given by
TEST_DATABASE_URL (which must already exist and end with `_test`).
"""

import os
from dotenv import load_dotenv

load_dotenv()

# os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
# os.environ["DATABASE_URL"] = (
#     "postgresql+asyncpg://test:test@localhost:5432/unused_test_db"
# )
# os.environ["FIRST_SUPERUSER_EMAIL"] = "superadmin@example.com"
# os.environ["FIRST_SUPERUSER_PASSWORD"] = "SuperAdmin123"
# os.environ["APP_ENV"] = "development"
# os.environ["DEBUG"] = "false"
# os.environ["CORS_ORIGINS"] = ""
# os.environ["ALLOWED_HOSTS"] = ""
# os.environ["FX_AUTO_FETCH"] = "false"

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import create_access_token, hash_password
from app.db.database import Base, get_db
from app.main import app
from app.models.ClientProfile import ClientProfile
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.Project import BillingType, Project, ProjectStatus
from app.models.User import User, UserRole

# ---------------------------------------------------------------------------
# Test database: a dedicated Postgres database (TEST_DATABASE_URL), independent
# of the app's own `engine`/`async_session` in app.db.database (which stays
# pointed at the fake URL above and is never actually connected to in tests).
# The schema is created and dropped around every test, so the database name
# must clearly be a throwaway one -- we refuse to run against anything else.
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/paylancr_test"
)

_test_db_name = make_url(TEST_DATABASE_URL).database or ""
if not "test" in _test_db_name:
    raise RuntimeError(
        f"Refusing to run tests against database {_test_db_name!r}: the test "
        "database name must end with '_test' because every test drops all tables."
    )

# NullPool: pytest-asyncio gives each test its own event loop, and asyncpg
# connections cannot be reused across loops.
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def _override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = _override_get_db


async def _reset_schema() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    """Build the schema once per run (dropping any leftovers from a crashed run).

    Sync on purpose: it avoids session-scoped async fixtures and their event
    loop scoping. NullPool means no connection outlives the temporary loop.
    """
    asyncio.run(_reset_schema())
    yield
    asyncio.run(_drop_schema())


async def _drop_schema() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


_ALL_TABLES = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)


@pytest_asyncio.fixture(autouse=True)
async def _clean_database():
    """Empty every table after each test — isolation without rebuilding the schema."""
    yield
    async with test_engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {_ALL_TABLES} RESTART IDENTITY CASCADE"))


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Seeding helpers (bypass the API for fast, direct fixture setup)
# ---------------------------------------------------------------------------


async def _make_user(
    db: AsyncSession,
    *,
    email: str,
    password: str = "Passw0rd1",
    full_name: str | None = "Test User",
    role: UserRole = UserRole.USER,
    is_active: bool = True,
    is_verified: bool = True,
    with_freelancer: bool = True,
) -> User:
    user = User(
        email=email.lower(),
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        is_active=is_active,
        is_verified=is_verified,
    )
    db.add(user)
    await db.flush()
    if with_freelancer:
        db.add(FreelancerProfile(user_id=user.id, currency="USD"))
    await db.commit()
    await db.refresh(user)
    return user


def _auth_header(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def make_user(db_session):
    """Factory fixture: await make_user(email=..., **kwargs) -> User."""

    async def _factory(**kwargs) -> User:
        kwargs.setdefault("email", f"{uuid.uuid4().hex}@example.com")
        return await _make_user(db_session, **kwargs)

    return _factory


@pytest_asyncio.fixture
async def user(db_session) -> User:
    return await _make_user(db_session, email="freelancer@example.com")


@pytest_asyncio.fixture
def auth_headers(user) -> dict[str, str]:
    return _auth_header(user)


@pytest_asyncio.fixture
async def other_user(db_session) -> User:
    """A second, unrelated freelancer account — used for ownership/IDOR tests."""
    return await _make_user(db_session, email="other-freelancer@example.com")


@pytest_asyncio.fixture
def other_auth_headers(other_user) -> dict[str, str]:
    return _auth_header(other_user)


@pytest_asyncio.fixture
async def freelancer_profile(db_session, user: User) -> FreelancerProfile:
    await db_session.refresh(user, attribute_names=["freelancer"])
    return user.freelancer


@pytest_asyncio.fixture
async def make_client_profile(db_session):
    """Factory: await make_client_profile(freelancer_id=..., **kwargs) -> ClientProfile."""

    async def _factory(*, freelancer_id: uuid.UUID, **kwargs) -> ClientProfile:
        kwargs.setdefault("name", "Acme Co")
        kwargs.setdefault("email", f"{uuid.uuid4().hex}@client-example.com")
        client_profile = ClientProfile(freelancer_id=freelancer_id, **kwargs)
        db_session.add(client_profile)
        await db_session.commit()
        await db_session.refresh(client_profile)
        return client_profile

    return _factory


@pytest_asyncio.fixture
async def client_profile(
    db_session, freelancer_profile: FreelancerProfile
) -> ClientProfile:
    cp = ClientProfile(
        freelancer_id=freelancer_profile.id,
        name="Acme Co",
        email="client@acme-example.com",
    )
    db_session.add(cp)
    await db_session.commit()
    await db_session.refresh(cp)
    return cp


@pytest_asyncio.fixture
async def make_project(db_session):
    """Factory: await make_project(client_id=..., created_by=..., **kwargs) -> Project."""

    async def _factory(
        *, client_id: uuid.UUID, created_by: uuid.UUID, **kwargs
    ) -> Project:
        kwargs.setdefault("name", "Website Revamp")
        kwargs.setdefault("status", ProjectStatus.ACTIVE)
        kwargs.setdefault("billing_type", BillingType.FIXED)
        kwargs.setdefault("milestones_enabled", True)
        project = Project(client_id=client_id, created_by=created_by, **kwargs)
        db_session.add(project)
        await db_session.commit()
        await db_session.refresh(project)
        return project

    return _factory


@pytest_asyncio.fixture
async def project(db_session, client_profile: ClientProfile, user: User) -> Project:
    p = Project(
        name="Website Revamp",
        client_id=client_profile.id,
        created_by=user.id,
        status=ProjectStatus.ACTIVE,
        billing_type=BillingType.FIXED,
        milestones_enabled=True,
    )
    db_session.add(p)
    await db_session.commit()
    await db_session.refresh(p)
    return p


@pytest_asyncio.fixture
async def make_milestone(db_session):
    """Factory: await make_milestone(project_id=..., **kwargs) -> Milestone."""

    async def _factory(*, project_id: uuid.UUID, **kwargs) -> Milestone:
        kwargs.setdefault("name", "Phase 1")
        kwargs.setdefault("status", MilestoneStatus.PENDING)
        milestone = Milestone(project_id=project_id, **kwargs)
        db_session.add(milestone)
        await db_session.commit()
        await db_session.refresh(milestone)
        return milestone

    return _factory


@pytest_asyncio.fixture
async def milestone(db_session, project: Project) -> Milestone:
    m = Milestone(name="Phase 1", project_id=project.id, status=MilestoneStatus.PENDING)
    db_session.add(m)
    await db_session.commit()
    await db_session.refresh(m)
    return m


@pytest_asyncio.fixture
async def make_portal_token(db_session):
    """Factory: issues a raw portal JWT + DB record without going through the
    submit-milestone flow, for tests that only need a valid token."""

    async def _factory(
        *,
        client_id: uuid.UUID,
        scope_type: ScopeType = ScopeType.PROJECT,
        scope: uuid.UUID | None = None,
        expires_in: timedelta = timedelta(days=14),
        revoked: bool = False,
    ) -> tuple[str, PortalAccessToken]:
        import jwt as pyjwt

        from app.core.config import settings

        now = datetime.now(timezone.utc)
        expires_at = now + expires_in
        jti = str(uuid.uuid4())

        record = PortalAccessToken(
            jti=jti,
            client_id=client_id,
            scope_type=scope_type,
            scope=scope,
            issued_at=now,
            expires_at=expires_at,
            revoked_at=now if revoked else None,
        )
        db_session.add(record)
        await db_session.commit()
        await db_session.refresh(record)

        payload = {
            "client_id": str(client_id),
            "jti": jti,
            "scope_type": scope_type.value,
            "scope": str(scope) if scope else None,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        token = pyjwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return token, record

    return _factory
