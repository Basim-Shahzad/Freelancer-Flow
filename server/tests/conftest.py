"""
Shared pytest fixtures.

IMPORTANT: environment variables must be set before `app.core.config` (and
therefore `app.main`, `app.db.database`, ...) is imported anywhere, because
`Settings` is instantiated once at import time as a module-level singleton
(`settings = get_settings()`). We use fake, never-connected-to values so the
suite never touches the developer's real Postgres instance or .env secrets.
"""

import os

os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/unused_test_db"
os.environ["FIRST_SUPERUSER_EMAIL"] = "superadmin@example.com"
os.environ["FIRST_SUPERUSER_PASSWORD"] = "SuperAdmin123"
os.environ["APP_ENV"] = "development"
os.environ["DEBUG"] = "false"
os.environ["CORS_ORIGINS"] = ""
os.environ["ALLOWED_HOSTS"] = ""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.database import Base, get_db
from app.main import app
from app.models.ClientProfile import ClientProfile
from app.models.FreelancerProfile import FreelancerProfile
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.Project import BudgetType, Project, ProjectStatus
from app.models.User import User, UserRole

# ---------------------------------------------------------------------------
# Test database: isolated in-memory SQLite, independent of the app's own
# `engine`/`async_session` in app.db.database (which stays pointed at the
# fake Postgres URL above and is never actually connected to in tests).
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


# SQLite has no native tz-aware storage: aiosqlite round-trips DateTime
# values as naive datetimes, which breaks model code that legitimately
# assumes tz-aware values coming back from Postgres (e.g.
# RefreshToken.is_expired doing `datetime.now(timezone.utc) >=
# self.expires_at`). This is purely a test-backend quirk, not an app bug --
# patch the sqlite dialect's DateTime handling to always attach UTC tzinfo
# on load, so model code sees the same tz-aware values it would on Postgres.
from sqlalchemy import types as _sqltypes
from sqlalchemy.dialects.sqlite import DATETIME as _SQLiteDATETIME


class _TZAwareSQLiteDateTime(_SQLiteDATETIME):
    def result_processor(self, dialect, coltype):
        processor = super().result_processor(dialect, coltype)

        def process(value):
            dt = processor(value) if processor else value
            if dt is not None and dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt

        return process


test_engine.dialect.colspecs = {
    **test_engine.dialect.colspecs,
    _sqltypes.DateTime: _TZAwareSQLiteDateTime,
}


async def _override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _clean_database():
    """Fresh schema for every test — full isolation, no cross-test leakage."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


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
        db.add(FreelancerProfile(user_id=user.id))
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
async def client_profile(db_session, freelancer_profile: FreelancerProfile) -> ClientProfile:
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

    async def _factory(*, client_id: uuid.UUID, created_by: uuid.UUID, **kwargs) -> Project:
        kwargs.setdefault("name", "Website Revamp")
        kwargs.setdefault("status", ProjectStatus.ACTIVE)
        kwargs.setdefault("budget_type", BudgetType.FIXED)
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
        budget_type=BudgetType.FIXED,
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
