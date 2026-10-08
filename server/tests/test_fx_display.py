"""Display-only conversion (Step 8): pure service, rates endpoint, portal block."""

from datetime import date
from decimal import Decimal

import pytest

from app.db.crud import reference as ref_crud
from app.services.fx import convert_for_display, display_currency_for

RATES = {
    "base": "USD",
    "rates": {"PKR": "281.25", "EUR": "0.92", "JPY": "150.1"},
    "as_of": "2025-10-05",
    "source": "open.er-api.com",
}


def test_direct_pair_usd_to_pkr():
    d = convert_for_display(Decimal("1000"), "USD", "PKR", RATES)
    assert d.currency == "PKR"
    assert d.amount == Decimal("281250.00")
    assert d.rate == Decimal("281.25")
    assert d.as_of == date(2025, 10, 5)
    assert d.source == "open.er-api.com"
    assert d.is_estimate is True


def test_inverse_pair_pkr_to_usd_rounds_half_up():
    d = convert_for_display(Decimal("100000"), "PKR", "USD", RATES)
    assert d.amount == Decimal("355.56")  # 355.5555...
    assert d.currency == "USD"


def test_cross_pair_goes_through_base():
    d = convert_for_display(Decimal("100"), "EUR", "PKR", RATES)
    assert d.amount == Decimal("30570.65")  # 100 / 0.92 * 281.25


def test_rounding_follows_target_currency_exponent():
    d = convert_for_display(Decimal("10"), "USD", "JPY", RATES)
    assert d.amount == Decimal("1501")  # JPY has no minor unit


@pytest.mark.parametrize(
    "rates,to",
    [
        ({"base": "USD", "rates": {}, "as_of": None}, "PKR"),
        (RATES, "AED"),
        ({"base": "USD", "rates": {"PKR": "0"}}, "PKR"),
        ({"base": "USD", "rates": {"PKR": "abc"}}, "PKR"),
    ],
)
def test_missing_or_bad_rate_returns_none(rates, to):
    assert convert_for_display(Decimal("5"), "USD", to, rates) is None


def test_same_currency_returns_none():
    assert convert_for_display(Decimal("5"), "USD", "USD", RATES) is None


def test_missing_as_of_is_none():
    d = convert_for_display(Decimal("1"), "USD", "PKR", {**RATES, "as_of": None})
    assert d.as_of is None


def test_display_currency_for():
    assert display_currency_for("USD") == "PKR"
    assert display_currency_for("pkr") == "USD"
    assert display_currency_for("EUR") is None
    assert display_currency_for(None) is None


# -- /reference/exchange-rates ------------------------------------------------


async def _store_rates(db):
    await ref_crud.seed_reference_settings(db)
    await ref_crud.set_setting(
        db,
        ref_crud.EXCHANGE_RATES,
        {**RATES, "manual_override": True},
        reference_date=date(2025, 10, 5),
    )


async def test_rates_endpoint_requires_auth(client):
    assert (await client.get("/api/v1/reference/exchange-rates")).status_code == 401


async def test_rates_endpoint_for_non_admin(client, db_session, auth_headers):
    await _store_rates(db_session)
    r = await client.get("/api/v1/reference/exchange-rates", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {
        "base": "USD",
        "rates": RATES["rates"],
        "asOf": "2025-10-05",
        "source": "open.er-api.com",
    }


async def test_rates_endpoint_empty_cache_is_not_an_error(client, db_session, auth_headers):
    await ref_crud.seed_reference_settings(db_session)
    r = await client.get("/api/v1/reference/exchange-rates", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["rates"] == {}
    assert r.json()["asOf"] is None


# -- portal invoice carries the same block -----------------------------------


async def test_portal_invoice_includes_exchange_rates(
    client, db_session, auth_headers, project
):
    await _store_rates(db_session)
    created = await client.post(
        "/api/v1/invoices",
        json={
            "projectId": str(project.id),
            "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
        },
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    invoice_id = created.json()["id"]
    sent = await client.post(f"/api/v1/invoices/{invoice_id}/send", headers=auth_headers)
    token = sent.json()["portalUrl"].split("token=", 1)[1]

    r = await client.get(f"/api/v1/portal/invoice/{invoice_id}", params={"token": token})
    assert r.status_code == 200, r.text
    assert r.json()["exchangeRates"] == {
        "base": "USD",
        "rates": RATES["rates"],
        "asOf": "2025-10-05",
        "source": "open.er-api.com",
    }
    # Owner view is unchanged: no rates block, no stored conversions.
    owner = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert "exchangeRates" not in owner.json()
