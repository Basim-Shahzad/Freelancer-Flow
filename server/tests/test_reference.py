"""Reference-data store and automatic exchange-rate refresh. No real network."""

import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.db.crud import reference as crud
from app.models.ActivityEvent import ActivityEvent
from app.models.User import UserRole
from app.services import fx_fetch
from app.core.security import create_access_token

PROVIDER_UNIX = 1759622401  # 2025-10-05 00:00:01 UTC
PROVIDER_OK = {
    "result": "success",
    "base_code": "USD",
    "time_last_update_unix": PROVIDER_UNIX,
    "rates": {"USD": 1, "PKR": 281.25, "EUR": 0.92, "GBP": 0.78, "AED": 3.6725, "JPY": 150.1},
}


def _provider(payload=None, status=200, calls=None, delay=0.0):
    async def handler(request: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(request.url)
        if delay:
            await asyncio.sleep(delay)
        return httpx.Response(status, json=PROVIDER_OK if payload is None else payload)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture
def fx_on(monkeypatch):
    monkeypatch.setattr(settings, "FX_AUTO_FETCH", True)


@pytest.fixture
async def admin(make_user):
    return await make_user(role=UserRole.ADMIN, with_freelancer=False)


@pytest.fixture
def admin_headers(admin):
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


@pytest.fixture
async def seeded(db_session):
    await crud.seed_reference_settings(db_session)


async def _make_stale(db, hours=48):
    old = datetime.now(timezone.utc) - timedelta(hours=hours)
    value = {
        "base": "USD",
        "rates": {"PKR": "270.0"},
        "as_of": "2025-01-01",
        "source": "old.example",
        "fetched_at": old.isoformat(),
        "manual_override": False,
    }
    await crud.set_setting(db, crud.EXCHANGE_RATES, value, reference_date=None)


# ── Access control ────────────────────────────────────────────────────────────


async def test_requires_auth(client, seeded):
    assert (await client.get("/api/v1/admin/reference")).status_code == 401


async def test_non_admin_gets_403(client, seeded, auth_headers):
    assert (await client.get("/api/v1/admin/reference", headers=auth_headers)).status_code == 403
    assert (
        await client.get("/api/v1/admin/reference/exchange_rates", headers=auth_headers)
    ).status_code == 403
    r = await client.put(
        "/api/v1/admin/reference/payment_texts",
        headers=auth_headers,
        json={"value": {"esfca_purpose_of_payment": "x"}},
    )
    assert r.status_code == 403
    r = await client.post(
        "/api/v1/admin/reference/exchange_rates/refresh", headers=auth_headers
    )
    assert r.status_code == 403


# ── Admin read / override ─────────────────────────────────────────────────────


async def test_admin_lists_and_reads(client, seeded, admin_headers):
    r = await client.get("/api/v1/admin/reference", headers=admin_headers)
    assert r.status_code == 200
    assert [s["key"] for s in r.json()] == ["exchange_rates", "payment_texts"]

    r = await client.get("/api/v1/admin/reference/payment_texts", headers=admin_headers)
    assert r.json()["value"]["esfca_purpose_of_payment"] == (
        "Payment for IT / software services export"
    )


async def test_unknown_key_404(client, seeded, admin_headers):
    assert (
        await client.get("/api/v1/admin/reference/nope", headers=admin_headers)
    ).status_code == 404
    r = await client.put(
        "/api/v1/admin/reference/nope", headers=admin_headers, json={"value": {"a": 1}}
    )
    assert r.status_code == 404


async def test_admin_override_payment_texts_is_audited(client, seeded, admin_headers, admin, db_session):
    r = await client.put(
        "/api/v1/admin/reference/payment_texts",
        headers=admin_headers,
        json={"value": {"esfca_purpose_of_payment": "Export of software services"}, "notes": "wording"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["value"]["esfca_purpose_of_payment"] == "Export of software services"
    assert body["updated_by"] == str(admin.id)

    events = (await db_session.execute(select(ActivityEvent))).scalars().all()
    assert [e.entity_type for e in events] == ["reference_setting"]
    assert events[0].user_id == admin.id
    assert "value" in events[0].changes


async def test_invalid_value_shape_422(client, seeded, admin_headers):
    r = await client.put(
        "/api/v1/admin/reference/payment_texts", headers=admin_headers, json={"value": {"wrong": "x"}}
    )
    assert r.status_code == 422
    r = await client.put(
        "/api/v1/admin/reference/payment_texts",
        headers=admin_headers,
        json={"value": {"esfca_purpose_of_payment": ""}},
    )
    assert r.status_code == 422


@pytest.mark.parametrize("rates", [{"PKR": "abc"}, {"PKR": "0"}, {"PKR": "-5"}])
async def test_invalid_rates_422(client, seeded, admin_headers, rates):
    r = await client.put(
        "/api/v1/admin/reference/exchange_rates",
        headers=admin_headers,
        json={"value": {"base": "USD", "rates": rates}},
    )
    assert r.status_code == 422


async def test_put_exchange_rates_sets_manual_override(client, seeded, admin_headers):
    r = await client.put(
        "/api/v1/admin/reference/exchange_rates",
        headers=admin_headers,
        json={"value": {"base": "USD", "rates": {"PKR": "300.5"}}, "reference_date": "2025-10-01"},
    )
    assert r.status_code == 200
    assert r.json()["value"]["manual_override"] is True
    assert r.json()["value"]["rates"] == {"PKR": "300.5"}
    assert r.json()["reference_date"] == "2025-10-01"


# ── Seeding ───────────────────────────────────────────────────────────────────


async def test_seed_is_idempotent_and_keeps_edits(db_session):
    await crud.seed_reference_settings(db_session)
    await crud.set_setting(
        db_session, crud.PAYMENT_TEXTS, {"esfca_purpose_of_payment": "Edited"}
    )
    await crud.seed_reference_settings(db_session)

    settings_ = await crud.list_settings(db_session)
    assert len(settings_) == 2
    assert await crud.get_esfca_purpose_of_payment(db_session) == "Edited"


async def test_typed_reader_falls_back_to_default_when_unseeded(db_session):
    assert await crud.get_esfca_purpose_of_payment(db_session) == (
        "Payment for IT / software services export"
    )


# ── fetch_rates ───────────────────────────────────────────────────────────────


async def test_fetch_rates_keeps_only_configured_currencies_as_strings():
    value = await fx_fetch.fetch_rates(_provider())
    assert set(value["rates"]) == {"PKR", "EUR", "GBP", "AED"}
    assert all(isinstance(v, str) for v in value["rates"].values())
    assert value["rates"]["PKR"] == "281.25"
    assert value["as_of"] == "2025-10-05"
    assert value["source"] == "open.er-api.com"
    assert value["manual_override"] is False


@pytest.mark.parametrize(
    "payload,status",
    [
        (None, 500),
        ({"result": "error"}, 200),
        ({"result": "success", "rates": {"PKR": 1}}, 200),  # no timestamp
        ({"result": "success", "time_last_update_unix": 1, "rates": {"JPY": 1}}, 200),
        ({"result": "success", "time_last_update_unix": 1, "rates": {"PKR": "abc"}}, 200),
        ({"result": "success", "time_last_update_unix": 1, "rates": {"PKR": 0}}, 200),
    ],
)
async def test_fetch_rates_rejects_bad_responses(payload, status):
    with pytest.raises(fx_fetch.FxFetchError):
        await fx_fetch.fetch_rates(_provider(payload, status))


async def test_fetch_rates_wraps_timeouts():
    def boom(request):
        raise httpx.ConnectTimeout("slow")

    client = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    with pytest.raises(fx_fetch.FxFetchError):
        await fx_fetch.fetch_rates(client)


# ── get_exchange_rates ────────────────────────────────────────────────────────


async def test_stale_cache_refreshes(db_session, seeded, fx_on):
    await _make_stale(db_session)
    calls = []

    value = await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))

    assert len(calls) == 1
    assert value["rates"]["PKR"] == "281.25"
    assert value["as_of"] == "2025-10-05"
    setting = await crud.get_setting(db_session, crud.EXCHANGE_RATES)
    assert setting.updated_by is None
    assert str(setting.reference_date) == "2025-10-05"


async def test_empty_seed_fetches_on_first_read(db_session, seeded, fx_on):
    calls = []
    value = await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert len(calls) == 1 and value["rates"]["PKR"] == "281.25"


async def test_fresh_cache_does_not_refetch(db_session, seeded, fx_on):
    calls = []
    await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert len(calls) == 1


@pytest.mark.parametrize("failure", ["http500", "malformed", "timeout"])
async def test_failed_fetch_returns_stale_cache_without_raising(db_session, seeded, fx_on, failure):
    await _make_stale(db_session)
    if failure == "http500":
        client = _provider(status=500)
    elif failure == "malformed":
        client = _provider(payload={"unexpected": True})
    else:

        def boom(request):
            raise httpx.ReadTimeout("slow")

        client = httpx.AsyncClient(transport=httpx.MockTransport(boom))

    value = await fx_fetch.get_exchange_rates(db_session, client)

    assert value["rates"] == {"PKR": "270.0"}
    assert value["as_of"] == "2025-01-01"  # real, older date is kept
    assert value["source"] == "old.example"


async def test_auto_fetch_disabled_never_fetches(db_session, seeded):
    assert settings.FX_AUTO_FETCH is False
    calls = []
    await _make_stale(db_session)
    value = await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert calls == []
    assert value["rates"] == {"PKR": "270.0"}


async def test_missing_setting_returns_empty_defaults(db_session, fx_on):
    calls = []
    value = await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert calls == []
    assert value["rates"] == {}


async def test_manual_override_stops_refresh_until_refresh_called(
    client, db_session, seeded, fx_on, admin_headers, monkeypatch
):
    r = await client.put(
        "/api/v1/admin/reference/exchange_rates",
        headers=admin_headers,
        json={"value": {"base": "USD", "rates": {"PKR": "300"}}},
    )
    assert r.status_code == 200
    calls = []

    value = await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert calls == [] and value["rates"] == {"PKR": "300"}

    # /refresh forces a fetch and clears the override.
    real_fetch = fx_fetch.fetch_rates

    async def fetch_with_mock(client=None):
        return await real_fetch(_provider(calls=calls))

    monkeypatch.setattr(fx_fetch, "fetch_rates", fetch_with_mock)
    r = await client.post("/api/v1/admin/reference/exchange_rates/refresh", headers=admin_headers)
    assert r.status_code == 200
    assert len(calls) == 1
    assert r.json()["value"]["manual_override"] is False
    assert r.json()["value"]["rates"]["PKR"] == "281.25"

    # Auto-refresh is back on: stale again → fetches.
    await db_session.rollback()
    await _make_stale(db_session)
    await fx_fetch.get_exchange_rates(db_session, _provider(calls=calls))
    assert len(calls) == 2


async def test_refresh_failure_is_reported_to_admin(client, seeded, admin_headers, monkeypatch):
    async def failing(client=None):
        raise fx_fetch.FxFetchError("provider down")

    monkeypatch.setattr(fx_fetch, "fetch_rates", failing)
    r = await client.post("/api/v1/admin/reference/exchange_rates/refresh", headers=admin_headers)
    assert r.status_code == 400
    assert "provider down" in r.json()["detail"]


async def test_admin_refresh_is_audited_but_system_fetch_is_not(
    client, db_session, seeded, fx_on, admin_headers, monkeypatch
):
    await _make_stale(db_session)
    await fx_fetch.get_exchange_rates(db_session, _provider())
    assert (await db_session.execute(select(ActivityEvent))).scalars().all() == []

    real_fetch = fx_fetch.fetch_rates

    async def fetch_with_mock(client=None):
        return await real_fetch(_provider())

    monkeypatch.setattr(fx_fetch, "fetch_rates", fetch_with_mock)
    r = await client.post("/api/v1/admin/reference/exchange_rates/refresh", headers=admin_headers)
    assert r.status_code == 200
    events = (await db_session.execute(select(ActivityEvent))).scalars().all()
    assert len(events) == 1 and events[0].entity_type == "reference_setting"


async def test_concurrent_reads_fetch_once(db_session, seeded, fx_on):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    sessions = async_sessionmaker(bind=db_session.bind, expire_on_commit=False)

    calls = []
    provider = _provider(calls=calls, delay=0.05)

    async def read():
        async with sessions() as session:
            return await fx_fetch.get_exchange_rates(session, provider)

    results = await asyncio.gather(*(read() for _ in range(5)))

    assert len(calls) == 1
    assert all(r["rates"]["PKR"] == "281.25" for r in results)
