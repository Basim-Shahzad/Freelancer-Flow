"""Profile, expenses / runway, VAT remittances, change requests and the activity feed."""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

EXPENSES_URL = "/api/v1/expenses"
VAT_URL = "/api/v1/vat"
CR_URL = "/api/v1/change-requests"
ACTIVITY_URL = "/api/v1/activity"
PROFILE_URL = "/api/v1/profile"


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


async def test_profile_requires_auth_and_freelancer(client, make_user):
    assert (await client.get(PROFILE_URL)).status_code == 401
    from app.core.security import create_access_token

    plain = await make_user(email="plain-profile@example.com", with_freelancer=False)
    headers = {"Authorization": f"Bearer {create_access_token(plain.id)}"}
    assert (await client.get(PROFILE_URL, headers=headers)).status_code == 403


async def test_profile_defaults_and_update(client, auth_headers):
    body = (await client.get(PROFILE_URL, headers=auth_headers)).json()
    assert body["currency"] == "SAR" and body["defaultPaymentTermsDays"] == 30
    assert Decimal(body["defaultTaxRate"]) == 0 and body["bankBalance"] is None

    resp = await client.patch(
        PROFILE_URL,
        json={
            "type": "Designer", "businessName": "Studio", "vatNumber": "123",
            "logoUrl": "https://example.com/logo.png", "bankBalance": "12000.50",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["type"] == "Designer" and body["businessName"] == "Studio"
    assert Decimal(body["bankBalance"]) == Decimal("12000.50")
    assert body["bankBalanceUpdatedAt"] is not None


async def test_profile_validation(client, auth_headers):
    for bad in (
        {"currency": "RIYAL"}, {"defaultTaxRate": "150"}, {"defaultPaymentTermsDays": -1},
        {"hourlyRate": "-1"}, {"logoUrl": "not a url"}, {"currency": None},
    ):
        assert (await client.patch(PROFILE_URL, json=bad, headers=auth_headers)).status_code == 422, bad


# ---------------------------------------------------------------------------
# Expenses + runway
# ---------------------------------------------------------------------------


def _expense(**extra):
    return {
        "description": "Figma", "amount": "100", "incurredOn": date.today().isoformat(), **extra
    }


async def test_expense_crud_and_ownership(client, auth_headers, other_auth_headers):
    created = await client.post(EXPENSES_URL, json=_expense(category="software"), headers=auth_headers)
    assert created.status_code == 201, created.text
    expense = created.json()
    assert expense["currency"] == "SAR" and expense["isRecurring"] is False
    url = f"{EXPENSES_URL}/{expense['id']}"

    assert (await client.get(url, headers=other_auth_headers)).status_code == 404
    assert (await client.patch(url, json={"amount": "5"}, headers=other_auth_headers)).status_code == 404
    assert (await client.delete(url, headers=other_auth_headers)).status_code == 404

    patched = await client.patch(url, json={"amount": "120.25", "vendor": "Figma Inc"}, headers=auth_headers)
    assert patched.status_code == 200 and Decimal(patched.json()["amount"]) == Decimal("120.25")

    listing = (await client.get(f"{EXPENSES_URL}?category=software", headers=auth_headers)).json()
    assert listing["total"] == 1
    assert (await client.delete(url, headers=auth_headers)).status_code == 204
    assert (await client.get(url, headers=auth_headers)).status_code == 404


async def test_expense_validation(client, auth_headers):
    for bad in (
        _expense(amount="0"), _expense(amount="-1"), _expense(isRecurring=True),
        _expense(isRecurring=False, recurrence="MONTHLY"),
        _expense(isRecurring=True, recurrence="MONTHLY", recurrenceEndsOn="2000-01-01"),
        _expense(currency="XX"), _expense(description=""),
    ):
        assert (await client.post(EXPENSES_URL, json=bad, headers=auth_headers)).status_code == 422, bad


async def test_expense_project_must_be_owned(client, auth_headers, other_user, db_session, make_client_profile, make_project):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    resp = await client.post(EXPENSES_URL, json=_expense(projectId=str(their_project.id)), headers=auth_headers)
    assert resp.status_code == 404


async def test_patching_to_non_recurring_clears_recurrence(client, auth_headers):
    expense = (
        await client.post(
            EXPENSES_URL, json=_expense(isRecurring=True, recurrence="MONTHLY"), headers=auth_headers
        )
    ).json()
    resp = await client.patch(f"{EXPENSES_URL}/{expense['id']}", json={"isRecurring": False}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["recurrence"] is None
    only_flag = await client.patch(f"{EXPENSES_URL}/{expense['id']}", json={"isRecurring": True}, headers=auth_headers)
    assert only_flag.status_code == 422  # recurrence now missing


async def test_runway_from_recurring_and_one_off_costs(client, auth_headers):
    today = date.today()
    await client.patch(PROFILE_URL, json={"bankBalance": "30000"}, headers=auth_headers)
    # 1,200/month + 3,600/quarter (=1,200/mo) + 12,000/year (=1,000/mo) = 3,400/mo
    for amount, recurrence in (("1200", "MONTHLY"), ("3600", "QUARTERLY"), ("12000", "YEARLY")):
        r = await client.post(
            EXPENSES_URL,
            json=_expense(amount=amount, incurredOn=(today - timedelta(days=200)).isoformat(),
                          isRecurring=True, recurrence=recurrence),
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
    # One-off 600 within the trailing 3 months => 200/mo. An old one is ignored.
    await client.post(EXPENSES_URL, json=_expense(amount="600"), headers=auth_headers)
    await client.post(
        EXPENSES_URL, json=_expense(amount="9999", incurredOn=(today - timedelta(days=400)).isoformat()),
        headers=auth_headers,
    )
    # Ended and foreign-currency costs do not count.
    await client.post(
        EXPENSES_URL,
        json=_expense(amount="5000", incurredOn=(today - timedelta(days=300)).isoformat(),
                      isRecurring=True, recurrence="MONTHLY",
                      recurrenceEndsOn=(today - timedelta(days=100)).isoformat()),
        headers=auth_headers,
    )
    await client.post(EXPENSES_URL, json=_expense(amount="777", currency="USD"), headers=auth_headers)

    body = (await client.get(f"{EXPENSES_URL}/runway", headers=auth_headers)).json()
    assert Decimal(body["monthlyRecurring"]) == Decimal("3400.00")
    assert Decimal(body["monthlyOneOffAverage"]) == Decimal("200.00")
    assert Decimal(body["monthlyBurn"]) == Decimal("3600.00")
    assert Decimal(body["bankBalance"]) == Decimal("30000.00")
    assert Decimal(body["runwayMonths"]) == Decimal("8.3")


async def test_runway_is_null_without_balance_or_burn(client, auth_headers):
    empty = (await client.get(f"{EXPENSES_URL}/runway", headers=auth_headers)).json()
    assert empty["runwayMonths"] is None and Decimal(empty["monthlyBurn"]) == 0
    await client.patch(PROFILE_URL, json={"bankBalance": "1000"}, headers=auth_headers)
    assert (await client.get(f"{EXPENSES_URL}/runway", headers=auth_headers)).json()["runwayMonths"] is None


# ---------------------------------------------------------------------------
# VAT
# ---------------------------------------------------------------------------


async def _issued_invoice(client, headers, project_id, subtotal="1000", tax="15", send=True):
    resp = await client.post(
        "/api/v1/invoices",
        json={"projectId": str(project_id), "taxRate": tax,
              "items": [{"description": "x", "quantity": "1", "unitPrice": subtotal}]},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    if send:
        await client.post(f"/api/v1/invoices/{resp.json()['id']}/send", headers=headers)
    return resp.json()


def _period():
    today = date.today()
    return {"period_start": (today - timedelta(days=30)).isoformat(), "period_end": (today + timedelta(days=1)).isoformat()}


async def test_vat_summary_counts_only_issued_invoices(client, auth_headers, project):
    await _issued_invoice(client, auth_headers, project.id)                      # 150
    await _issued_invoice(client, auth_headers, project.id, subtotal="200")      # 30
    await _issued_invoice(client, auth_headers, project.id, send=False)          # draft: excluded
    cancelled = await _issued_invoice(client, auth_headers, project.id)
    await client.post(f"/api/v1/invoices/{cancelled['id']}/cancel", headers=auth_headers)

    body = (await client.get(f"{VAT_URL}/summary", params=_period(), headers=auth_headers)).json()
    assert Decimal(body["vatCollected"]) == Decimal("180.00")
    assert Decimal(body["vatRemitted"]) == 0 and Decimal(body["vatOutstanding"]) == Decimal("180.00")


async def test_vat_remittance_reduces_outstanding(client, auth_headers, project):
    await _issued_invoice(client, auth_headers, project.id)  # 150
    period = _period()
    created = await client.post(
        f"{VAT_URL}/remittances",
        json={"periodStart": period["period_start"], "periodEnd": date.today().isoformat(),
              "amount": "100", "reference": "ZATCA-1"},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["currency"] == "SAR"

    body = (await client.get(f"{VAT_URL}/summary", params=period, headers=auth_headers)).json()
    assert Decimal(body["vatRemitted"]) == Decimal("100.00")
    assert Decimal(body["vatOutstanding"]) == Decimal("50.00")

    listing = (await client.get(f"{VAT_URL}/remittances", headers=auth_headers)).json()
    assert listing["total"] == 1

    # Over-remitting never yields a negative outstanding figure.
    await client.post(
        f"{VAT_URL}/remittances",
        json={"periodStart": period["period_start"], "periodEnd": date.today().isoformat(), "amount": "500"},
        headers=auth_headers,
    )
    body = (await client.get(f"{VAT_URL}/summary", params=period, headers=auth_headers)).json()
    assert Decimal(body["vatOutstanding"]) == 0


async def test_vat_is_scoped_and_validated(client, auth_headers, other_auth_headers, project):
    await _issued_invoice(client, auth_headers, project.id)
    theirs = (await client.get(f"{VAT_URL}/summary", params=_period(), headers=other_auth_headers)).json()
    assert Decimal(theirs["vatCollected"]) == 0

    remittance = (
        await client.post(
            f"{VAT_URL}/remittances",
            json={"periodStart": "2026-01-01", "periodEnd": "2026-03-31", "amount": "10"},
            headers=auth_headers,
        )
    ).json()
    assert (await client.delete(f"{VAT_URL}/remittances/{remittance['id']}", headers=other_auth_headers)).status_code == 404
    assert (await client.delete(f"{VAT_URL}/remittances/{remittance['id']}", headers=auth_headers)).status_code == 204

    bad_period = {"period_start": "2026-03-01", "period_end": "2026-01-01"}
    assert (await client.get(f"{VAT_URL}/summary", params=bad_period, headers=auth_headers)).status_code == 422
    inverted = await client.post(
        f"{VAT_URL}/remittances",
        json={"periodStart": "2026-03-01", "periodEnd": "2026-01-01", "amount": "10"},
        headers=auth_headers,
    )
    assert inverted.status_code == 422
    assert (await client.get(f"{VAT_URL}/summary", params=_period())).status_code == 401


# ---------------------------------------------------------------------------
# Change requests
# ---------------------------------------------------------------------------


async def _cr(client, headers, project_id, **extra):
    return await client.post(
        CR_URL,
        json={"projectId": str(project_id), "title": "Add blog", "estimatedAmount": "1500",
              "estimatedHours": "12.5", **extra},
        headers=headers,
    )


async def test_change_request_lifecycle(client, auth_headers, project):
    created = await _cr(client, auth_headers, project.id)
    assert created.status_code == 201, created.text
    cr = created.json()
    assert cr["status"] == "PENDING" and Decimal(cr["estimatedAmount"]) == 1500
    url = f"{CR_URL}/{cr['id']}"

    edited = await client.patch(url, json={"estimatedAmount": "1800"}, headers=auth_headers)
    assert edited.status_code == 200 and Decimal(edited.json()["estimatedAmount"]) == 1800

    orphan_note = await client.patch(url, json={"decisionNote": "hm"}, headers=auth_headers)
    assert orphan_note.status_code == 422

    decided = await client.patch(url, json={"status": "APPROVED", "decisionNote": "Agreed"}, headers=auth_headers)
    assert decided.status_code == 200
    assert decided.json()["status"] == "APPROVED" and decided.json()["decidedAt"] is not None

    # Decisions are final.
    assert (await client.patch(url, json={"status": "REJECTED"}, headers=auth_headers)).status_code == 409
    assert (await client.patch(url, json={"title": "x"}, headers=auth_headers)).status_code == 409


async def test_change_request_list_filters_and_ownership(client, auth_headers, other_auth_headers, project):
    a = (await _cr(client, auth_headers, project.id)).json()
    await _cr(client, auth_headers, project.id, title="Second")
    await client.patch(f"{CR_URL}/{a['id']}", json={"status": "REJECTED"}, headers=auth_headers)

    all_ = (await client.get(f"{CR_URL}?projectId={project.id}", headers=auth_headers)).json()
    assert all_["total"] == 2
    pending = (await client.get(f"{CR_URL}?status=PENDING", headers=auth_headers)).json()
    assert pending["total"] == 1 and pending["changeRequests"][0]["title"] == "Second"

    assert (await client.get(f"{CR_URL}/{a['id']}", headers=other_auth_headers)).status_code == 404
    assert (await client.delete(f"{CR_URL}/{a['id']}", headers=other_auth_headers)).status_code == 404
    assert (await _cr(client, other_auth_headers, project.id)).status_code == 404
    assert (await client.delete(f"{CR_URL}/{a['id']}", headers=auth_headers)).status_code == 204


async def test_change_request_validation(client, auth_headers, project):
    for bad in ({"title": ""}, {"estimatedAmount": "-1"}, {"estimatedHours": "-2"}):
        assert (await _cr(client, auth_headers, project.id, **bad)).status_code == 422, bad


# ---------------------------------------------------------------------------
# Activity feed
# ---------------------------------------------------------------------------


async def test_activity_feed_keeps_what_changed(client, auth_headers, project):
    resp = await client.patch(
        f"/api/v1/projects/{project.id}", json={"name": "Renamed", "status": "PAUSED"}, headers=auth_headers
    )
    assert resp.status_code == 200

    feed = (await client.get(ACTIVITY_URL, params={"entity_type": "project", "entity_id": str(project.id)}, headers=auth_headers)).json()
    event = feed["events"][0]
    assert event["action"] == "updated"
    assert event["changes"]["name"] == {"old": "Website Revamp", "new": "Renamed"}
    assert event["changes"]["status"] == {"old": "ACTIVE", "new": "PAUSED"}


async def test_activity_feed_is_scoped_ordered_and_filterable(client, auth_headers, other_auth_headers, project):
    await client.patch(f"/api/v1/projects/{project.id}", json={"name": "One"}, headers=auth_headers)
    await client.patch(f"/api/v1/projects/{project.id}", json={"name": "Two"}, headers=auth_headers)
    await _cr(client, auth_headers, project.id)

    mine = (await client.get(ACTIVITY_URL, headers=auth_headers)).json()
    assert mine["total"] == 3
    stamps = [e["createdAt"] for e in mine["events"]]
    assert stamps == sorted(stamps, reverse=True)

    assert (await client.get(ACTIVITY_URL, headers=other_auth_headers)).json()["total"] == 0
    only_cr = (await client.get(ACTIVITY_URL, params={"entity_type": "change_request"}, headers=auth_headers)).json()
    assert only_cr["total"] == 1

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert (await client.get(ACTIVITY_URL, params={"since": future}, headers=auth_headers)).json()["total"] == 0
    assert (await client.get(ACTIVITY_URL, params={"limit": 500}, headers=auth_headers)).status_code == 422
    assert (await client.get(ACTIVITY_URL)).status_code == 401


async def test_no_activity_row_when_nothing_changed(client, auth_headers, project):
    await client.patch(f"/api/v1/projects/{project.id}", json={"name": "Website Revamp"}, headers=auth_headers)
    assert (await client.get(ACTIVITY_URL, headers=auth_headers)).json()["total"] == 0


async def test_payments_and_invoice_actions_appear_in_the_feed(client, auth_headers, project):
    invoice = await _issued_invoice(client, auth_headers, project.id, tax="0")
    await client.post(
        f"/api/v1/invoices/{invoice['id']}/payments", json={"amount": "100"}, headers=auth_headers
    )
    feed = (await client.get(ACTIVITY_URL, params={"entity_type": "invoice"}, headers=auth_headers)).json()
    assert {e["action"] for e in feed["events"]} == {"created", "sent", "payment_recorded"}
