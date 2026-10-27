"""Step 17: endpoint rate limits, trusted-proxy IP, body size cap, page-size cap,
production secret checks and OpenAPI generation."""

import uuid
from datetime import UTC

import pytest
from cryptography.fernet import Fernet
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, settings
from app.core.errors import RateLimited
from app.models.RateLimitCounter import RateLimitCounter
from app.services.rate_limit import check_rate_limit

API = "/api/v1"
LOGIN = f"{API}/auth/login"
REGISTER = f"{API}/auth/register"
PORTAL = f"{API}/portal"


def _login(client, email, password="wrong-Pass1", **headers):
    return client.post(LOGIN, json={"email": email, "password": password}, headers=headers)


def _register(client, email, **headers):
    return client.post(
        REGISTER,
        json={"email": email, "password": "Passw0rd1", "fullName": "New User"},
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Login / register limits
# ---------------------------------------------------------------------------


async def test_login_blocks_after_per_email_limit_and_sends_retry_after(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 3)
    for _ in range(3):
        assert (await _login(client, "victim@example.com")).status_code == 401
    blocked = await _login(client, "victim@example.com")
    assert blocked.status_code == 429
    assert int(blocked.headers["retry-after"]) >= 1
    assert "Too many attempts" in blocked.json()["detail"]
    # A different email from the same IP is not affected by the email counter.
    assert (await _login(client, "someone-else@example.com")).status_code == 401


async def test_email_limit_ignores_case_and_whitespace(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 2)
    await _login(client, "Victim@Example.com")
    await _login(client, " victim@example.com")
    assert (await _login(client, "VICTIM@example.com")).status_code == 429


async def test_login_blocks_after_per_ip_limit_across_emails(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_IP", 3)
    for i in range(3):
        assert (await _login(client, f"user{i}@example.com")).status_code == 401
    assert (await _login(client, "user99@example.com")).status_code == 429


async def test_successful_logins_count_too(client, user, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 2)
    for _ in range(2):
        assert (await _login(client, user.email, "Passw0rd1")).status_code == 200
    assert (await _login(client, user.email, "Passw0rd1")).status_code == 429


async def test_register_is_limited_per_ip_and_per_email(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_IP", 3)
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 2)
    # Same email twice: second is 409 (taken), third trips the email counter.
    assert (await _register(client, "dup@example.com")).status_code == 201
    assert (await _register(client, "dup@example.com")).status_code == 409
    assert (await _register(client, "dup@example.com")).status_code == 429
    # Per-IP: the 3 attempts above used the budget, so a new email is refused too.
    assert (await _register(client, "fresh@example.com")).status_code == 429


async def test_login_and_register_counters_are_separate(client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 1)
    await _login(client, "same@example.com")
    assert (await _login(client, "same@example.com")).status_code == 429
    assert (await _register(client, "same@example.com")).status_code == 201


async def test_counters_live_in_the_database_and_hold_across_sessions(
    client, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 2)
    await _login(client, "shared@example.com")
    await _login(client, "shared@example.com")
    keys = (await db_session.execute(select(RateLimitCounter.key))).scalars().all()
    assert any(k.startswith("login:email:") for k in keys)
    assert not any("shared@example.com" in k for k in keys), "raw email stored in counter key"

    # A brand new session (another worker, after a restart) sees the same count.
    email_key = next(k for k in keys if k.startswith("login:email:"))
    async with AsyncSession(db_session.bind, expire_on_commit=False) as other_worker:
        with pytest.raises(RateLimited):
            await check_rate_limit(other_worker, email_key, limit=2, window_seconds=900)


async def test_limit_survives_failed_request(client, db_session, monkeypatch):
    """The attempt must stay counted even though the request itself failed."""
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_EMAIL", 1)
    assert (await _login(client, "x@example.com")).status_code == 401
    count = (await db_session.execute(select(RateLimitCounter.count))).scalars().all()
    assert count and all(c >= 1 for c in count)


# ---------------------------------------------------------------------------
# Client IP / trusted proxy header
# ---------------------------------------------------------------------------


async def test_forwarding_header_ignored_by_default(client, monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HEADER", "")
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_IP", 2)
    await _login(client, "a@example.com", **{"X-Forwarded-For": "1.1.1.1"})
    await _login(client, "b@example.com", **{"X-Forwarded-For": "2.2.2.2"})
    spoofed = await _login(client, "c@example.com", **{"X-Forwarded-For": "3.3.3.3"})
    assert spoofed.status_code == 429


async def test_forwarding_header_used_when_trusted(client, monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HEADER", "X-Forwarded-For")
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_IP", 2)
    for i in range(2):
        resp = await _login(client, f"a{i}@example.com", **{"X-Forwarded-For": "1.1.1.1, 10.0.0.1"})
        assert resp.status_code == 401
    assert (await _login(client, "z@example.com", **{"X-Forwarded-For": "1.1.1.1"})).status_code == 429
    # A different real client behind the same proxy has its own budget.
    other = await _login(client, "y@example.com", **{"X-Forwarded-For": "9.9.9.9"})
    assert other.status_code == 401


async def test_trusted_header_missing_falls_back_to_socket_peer(client, monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HEADER", "X-Forwarded-For")
    monkeypatch.setattr(settings, "AUTH_RATE_LIMIT_PER_IP", 1)
    await _login(client, "a@example.com")
    assert (await _login(client, "b@example.com")).status_code == 429


# ---------------------------------------------------------------------------
# Portal limit
# ---------------------------------------------------------------------------


async def test_portal_is_limited_per_ip_even_for_bad_tokens(client, project, monkeypatch):
    monkeypatch.setattr(settings, "PORTAL_RATE_LIMIT", 3)
    url = f"{PORTAL}/project/{project.id}"
    for _ in range(3):
        assert (await client.get(url, headers={"Authorization": "Bearer junk"})).status_code == 401
    blocked = await client.get(url, headers={"Authorization": "Bearer junk"})
    assert blocked.status_code == 429 and "retry-after" in blocked.headers


async def test_portal_limit_does_not_affect_authenticated_api(
    client, auth_headers, project, monkeypatch
):
    monkeypatch.setattr(settings, "PORTAL_RATE_LIMIT", 1)
    for _ in range(3):
        await client.get(f"{PORTAL}/project/{project.id}")
    assert (await client.get(f"{API}/projects", headers=auth_headers)).status_code == 200


async def test_export_has_a_per_ip_limit_too(client, auth_headers, other_auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "EXPORT_RATE_LIMIT", 1)  # per-IP budget = 3x
    for headers in (auth_headers, other_auth_headers):
        for _ in range(1):
            await client.post(f"{API}/export", json={"password": "wrong"}, headers=headers)
    # 2 used from the IP budget of 3; both users are now at/over their own budget.
    resp = await client.post(f"{API}/export", json={"password": "wrong"}, headers=auth_headers)
    assert resp.status_code == 429


# ---------------------------------------------------------------------------
# Opportunistic pruning
# ---------------------------------------------------------------------------


async def test_stale_rows_of_other_keys_are_pruned(db_session, monkeypatch):
    from datetime import datetime, timedelta

    from app.services import rate_limit

    old = datetime.now(UTC) - timedelta(days=3)
    db_session.add(RateLimitCounter(key="abandoned", window_start=old, count=5))
    await db_session.commit()
    monkeypatch.setattr(rate_limit, "GLOBAL_PRUNE_PROBABILITY", 1.0)
    await check_rate_limit(db_session, "live", limit=5, window_seconds=60)
    keys = (await db_session.execute(select(RateLimitCounter.key))).scalars().all()
    assert keys == ["live"]


async def test_recent_rows_of_other_keys_are_kept(db_session, monkeypatch):
    from datetime import datetime, timedelta

    from app.services import rate_limit

    recent = datetime.now(UTC) - timedelta(hours=1)
    db_session.add(RateLimitCounter(key="recent", window_start=recent, count=5))
    await db_session.commit()
    monkeypatch.setattr(rate_limit, "GLOBAL_PRUNE_PROBABILITY", 1.0)
    await check_rate_limit(db_session, "live", limit=5, window_seconds=60)
    keys = set((await db_session.execute(select(RateLimitCounter.key))).scalars().all())
    assert keys == {"recent", "live"}


# ---------------------------------------------------------------------------
# Request body size
# ---------------------------------------------------------------------------


async def test_declared_oversize_body_is_413(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_BYTES", 1000)
    payload = {"name": "x" * 2000}
    resp = await client.post(f"{API}/clients", json=payload, headers=auth_headers)
    assert resp.status_code == 413
    assert resp.json() == {"detail": "Request body too large"}


async def test_streamed_oversize_body_without_content_length_is_413(
    client, auth_headers, monkeypatch
):
    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_BYTES", 1000)

    async def body():
        for _ in range(5):
            yield b'{"name": "' + b"x" * 400 + b'"}'

    resp = await client.post(
        f"{API}/clients",
        content=body(),
        headers={**auth_headers, "Content-Type": "application/json"},
    )
    assert resp.status_code == 413


async def test_body_under_the_limit_passes_and_get_unaffected(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_BYTES", 1000)
    ok = await client.post(
        f"{API}/clients", json={"name": "Small", "email": "s@example.com"}, headers=auth_headers
    )
    assert ok.status_code == 201, ok.text
    assert (await client.get(f"{API}/clients", headers=auth_headers)).status_code == 200


async def test_bulk_endpoint_is_protected_by_body_limit(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "MAX_REQUEST_BODY_BYTES", 500)
    ids = [str(uuid.uuid4()) for _ in range(50)]
    resp = await client.patch(
        f"{API}/time-entries/bulk", json={"ids": ids, "set": {"isBillable": False}}, headers=auth_headers
    )
    assert resp.status_code == 413


# ---------------------------------------------------------------------------
# Page size
# ---------------------------------------------------------------------------

PAGED = ["/clients", "/projects", "/invoices", "/expenses", "/change-requests", "/tax/remittances"]


@pytest.mark.parametrize("path", PAGED)
async def test_limit_above_max_page_size_is_422(client, auth_headers, path):
    over = settings.MAX_PAGE_SIZE + 1
    assert (await client.get(f"{API}{path}?limit={over}", headers=auth_headers)).status_code == 422
    ok = await client.get(f"{API}{path}?limit={settings.MAX_PAGE_SIZE}", headers=auth_headers)
    assert ok.status_code == 200
    assert (await client.get(f"{API}{path}?limit=0", headers=auth_headers)).status_code == 422


async def test_time_entries_and_activity_are_capped(client, auth_headers, project):
    over = settings.MAX_PAGE_SIZE + 1
    resp = await client.get(f"{API}/time-entries/{project.id}?limit={over}", headers=auth_headers)
    assert resp.status_code == 422
    resp = await client.get(f"{API}/activity?limit=201", headers=auth_headers)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Production secrets
# ---------------------------------------------------------------------------

GOOD_SECRET = "k8Jx2mQ9vL4pZr7TnW1sB6dYc3HfGa0Ue5Io"


def _settings(**overrides) -> Settings:
    base = dict(
        APP_ENV="production",
        SECRET_KEY=GOOD_SECRET,
        FIELD_ENCRYPTION_KEY=Fernet.generate_key().decode(),
        DATABASE_URL="postgresql+asyncpg://u:p@h/d",
        FIRST_SUPERUSER_EMAIL="admin@example.com",
        FIRST_SUPERUSER_PASSWORD="Str0ngPassword!",
    )
    return Settings(_env_file=None, **{**base, **overrides})


def test_valid_production_settings_load():
    assert _settings().is_production


@pytest.mark.parametrize(
    "secret",
    ["secret", "changeme", "short", "x" * 31, "change-me-" + "a" * 40, "test-secret-key-do-not-use-in-production"],
)
def test_production_rejects_weak_or_default_secret_key(secret):
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _settings(SECRET_KEY=secret)


@pytest.mark.parametrize("key", ["", "not-a-fernet-key", "abc"])
def test_production_rejects_missing_or_invalid_encryption_key(key):
    with pytest.raises(ValidationError, match="FIELD_ENCRYPTION_KEY"):
        _settings(FIELD_ENCRYPTION_KEY=key)


def test_production_rejects_encryption_key_equal_to_secret_key():
    key = Fernet.generate_key().decode()
    with pytest.raises(ValidationError, match="must differ"):
        _settings(SECRET_KEY=key, FIELD_ENCRYPTION_KEY=key)


@pytest.mark.parametrize("env", ["development", "staging"])
def test_non_production_keeps_dev_defaults(env):
    s = _settings(APP_ENV=env, SECRET_KEY="short", FIELD_ENCRYPTION_KEY="")
    assert not s.is_production


# ---------------------------------------------------------------------------
# OpenAPI
# ---------------------------------------------------------------------------


async def test_openapi_and_docs_load_and_document_429(client):
    schema = await client.get(f"{API}/openapi.json")
    assert schema.status_code == 200
    paths = schema.json()["paths"]
    for path in (f"{API}/auth/login", f"{API}/auth/register", f"{API}/export"):
        assert "429" in paths[path]["post"]["responses"], path
    assert "429" in paths[f"{API}/portal/invoice/{{invoice_id}}"]["get"]["responses"]
    assert (await client.get(f"{API}/docs")).status_code == 200
