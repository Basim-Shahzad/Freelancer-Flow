"""Retainer-period invoicing (Step 14): period math, API and double-billing guard."""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.Expense import RecurrenceInterval
from app.models.Invoice import Invoice, InvoiceStatus
from app.services.retainer import period_end, period_label, period_starts

M = RecurrenceInterval.MONTHLY
Q = RecurrenceInterval.QUARTERLY

PROJECTS_URL = "/api/v1/projects"
INVOICES_URL = "/api/v1/invoices"


# ── pure helper ──────────────────────────────────────────────────────────────


def test_monthly_period_starts_include_the_start_and_stop_at_through():
    assert period_starts(date(2026, 1, 10), M, date(2026, 3, 10)) == [
        date(2026, 1, 10),
        date(2026, 2, 10),
        date(2026, 3, 10),
    ]
    assert period_starts(date(2026, 1, 10), M, date(2026, 3, 9)) == [
        date(2026, 1, 10),
        date(2026, 2, 10),
    ]


def test_quarterly_period_starts():
    assert period_starts(date(2026, 1, 15), Q, date(2026, 12, 31)) == [
        date(2026, 1, 15),
        date(2026, 4, 15),
        date(2026, 7, 15),
        date(2026, 10, 15),
    ]


def test_no_periods_before_the_start_date():
    assert period_starts(date(2026, 5, 1), M, date(2026, 4, 30)) == []


def test_month_end_clamps_but_later_periods_keep_the_original_day():
    assert period_starts(date(2026, 1, 31), M, date(2026, 5, 31)) == [
        date(2026, 1, 31),
        date(2026, 2, 28),
        date(2026, 3, 31),
        date(2026, 4, 30),
        date(2026, 5, 31),
    ]
    # Leap year February.
    assert date(2028, 2, 29) in period_starts(date(2028, 1, 31), M, date(2028, 3, 1))


def test_end_date_stops_periods():
    assert period_starts(date(2026, 1, 1), M, date(2026, 12, 31), date(2026, 3, 1)) == [
        date(2026, 1, 1),
        date(2026, 2, 1),
        date(2026, 3, 1),
    ]
    assert period_starts(date(2026, 1, 1), M, date(2026, 12, 31), date(2026, 2, 28)) == [
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]


def test_period_end_is_the_day_before_the_next_start():
    assert period_end(date(2026, 1, 31), date(2026, 1, 31), M) == date(2026, 2, 27)
    assert period_end(date(2026, 2, 28), date(2026, 1, 31), M) == date(2026, 3, 30)
    assert period_end(date(2026, 1, 15), date(2026, 1, 15), Q) == date(2026, 4, 14)
    assert period_end(date(2026, 4, 15), date(2026, 1, 15), Q) == date(2026, 7, 14)


def test_period_labels():
    assert period_label(date(2026, 10, 3), M) == "Oct 2026"
    assert period_label(date(2026, 10, 3), Q) == "Q4 2026"


def test_unsupported_interval_is_rejected():
    with pytest.raises(ValueError):
        period_starts(date(2026, 1, 1), RecurrenceInterval.YEARLY, date(2027, 1, 1))


# ── API ──────────────────────────────────────────────────────────────────────


def _months_ago(months: int) -> date:
    """First day of the month `months` back (day 1 never clamps)."""
    today = date.today()
    index = today.year * 12 + today.month - 1 - months
    year, month = divmod(index, 12)
    return date(year, month + 1, 1)


async def _retainer_project(client, headers, client_profile, **extra):
    body = {
        "name": "Retainer",
        "clientId": str(client_profile.id),
        "billingType": "RETAINER",
        "retainerAmount": "1500",
        "retainerInterval": "MONTHLY",
        "retainerStartDate": _months_ago(2).isoformat(),
        **extra,
    }
    resp = await client.post(PROJECTS_URL, json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _bill(client, headers, project_id, period_start, **extra):
    return await client.post(
        INVOICES_URL,
        json={
            "projectId": project_id,
            "retainerPeriodStart": period_start.isoformat(),
            **extra,
        },
        headers=headers,
    )


async def test_periods_list_runs_from_start_through_current_period(
    client, auth_headers, client_profile
):
    project = await _retainer_project(client, auth_headers, client_profile)
    resp = await client.get(
        f"{PROJECTS_URL}/{project['id']}/retainer-periods", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    periods = resp.json()["periods"]
    assert [p["periodStart"] for p in periods] == [
        _months_ago(2).isoformat(),
        _months_ago(1).isoformat(),
        _months_ago(0).isoformat(),
    ]
    assert all(p["invoiceId"] is None for p in periods)


async def test_periods_stop_at_retainer_end_date(client, auth_headers, client_profile):
    project = await _retainer_project(
        client,
        auth_headers,
        client_profile,
        retainerEndDate=_months_ago(1).isoformat(),
    )
    periods = (
        await client.get(
            f"{PROJECTS_URL}/{project['id']}/retainer-periods", headers=auth_headers
        )
    ).json()["periods"]
    assert [p["periodStart"] for p in periods] == [
        _months_ago(2).isoformat(),
        _months_ago(1).isoformat(),
    ]


async def test_end_date_must_be_after_start_date(client, auth_headers, client_profile):
    resp = await client.post(
        PROJECTS_URL,
        json={
            "name": "R",
            "clientId": str(client_profile.id),
            "billingType": "RETAINER",
            "retainerAmount": "100",
            "retainerInterval": "MONTHLY",
            "retainerStartDate": "2026-03-01",
            "retainerEndDate": "2026-03-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_periods_endpoint_rejects_non_retainer_and_foreign_projects(
    client, auth_headers, other_auth_headers, client_profile, project
):
    assert (
        await client.get(
            f"{PROJECTS_URL}/{project.id}/retainer-periods", headers=auth_headers
        )
    ).status_code == 422
    retainer = await _retainer_project(client, auth_headers, client_profile)
    assert (
        await client.get(
            f"{PROJECTS_URL}/{retainer['id']}/retainer-periods", headers=other_auth_headers
        )
    ).status_code in (403, 404)
    assert (await client.get(f"{PROJECTS_URL}/{retainer['id']}/retainer-periods")).status_code == 401


async def test_bill_the_current_period_adds_a_retainer_line(
    client, auth_headers, client_profile
):
    project = await _retainer_project(client, auth_headers, client_profile)
    resp = await _bill(client, auth_headers, project["id"], _months_ago(0), taxes=[])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["retainerPeriodStart"] == _months_ago(0).isoformat()
    assert len(body["items"]) == 1
    assert body["items"][0]["description"].startswith("Retainer — ")
    assert Decimal(body["items"][0]["amount"]) == Decimal(1500)
    assert Decimal(body["total"]) == Decimal(1500)

    periods = (
        await client.get(
            f"{PROJECTS_URL}/{project['id']}/retainer-periods", headers=auth_headers
        )
    ).json()["periods"]
    assert periods[-1]["invoiceId"] == body["id"]
    assert periods[0]["invoiceId"] is None


async def test_overage_lines_can_be_added_to_a_retainer_invoice(
    client, auth_headers, client_profile
):
    project = await _retainer_project(client, auth_headers, client_profile)
    resp = await _bill(
        client,
        auth_headers,
        project["id"],
        _months_ago(0),
        taxes=[],
        items=[{"description": "Extra hours", "quantity": "2", "unitPrice": "50"}],
    )
    assert resp.status_code == 201, resp.text
    assert Decimal(resp.json()["total"]) == Decimal(1600)


async def test_misaligned_or_future_periods_are_rejected(
    client, auth_headers, client_profile
):
    project = await _retainer_project(client, auth_headers, client_profile)
    misaligned = _months_ago(1).replace(day=2)
    assert (await _bill(client, auth_headers, project["id"], misaligned)).status_code == 422
    # In-advance billing covers the current period only, never a future one.
    future = _months_ago(-1)
    assert (await _bill(client, auth_headers, project["id"], future)).status_code == 422
    # Before the retainer began.
    assert (
        await _bill(client, auth_headers, project["id"], _months_ago(5))
    ).status_code == 422


async def test_retainer_period_on_non_retainer_project_is_rejected(
    client, auth_headers, project
):
    resp = await _bill(client, auth_headers, str(project.id), _months_ago(0))
    assert resp.status_code == 422


async def test_period_cannot_be_billed_twice(client, auth_headers, client_profile):
    project = await _retainer_project(client, auth_headers, client_profile)
    assert (await _bill(client, auth_headers, project["id"], _months_ago(1))).status_code == 201
    again = await _bill(client, auth_headers, project["id"], _months_ago(1))
    assert again.status_code == 409
    # Other periods are unaffected.
    assert (await _bill(client, auth_headers, project["id"], _months_ago(0))).status_code == 201


async def test_cancelling_the_invoice_frees_its_period(client, auth_headers, client_profile):
    project = await _retainer_project(client, auth_headers, client_profile)
    first = (await _bill(client, auth_headers, project["id"], _months_ago(0))).json()
    sent = await client.post(f"{INVOICES_URL}/{first['id']}/send", headers=auth_headers)
    assert sent.status_code == 200, sent.text
    cancelled = await client.post(f"{INVOICES_URL}/{first['id']}/cancel", headers=auth_headers)
    assert cancelled.status_code == 200, cancelled.text

    periods = (
        await client.get(
            f"{PROJECTS_URL}/{project['id']}/retainer-periods", headers=auth_headers
        )
    ).json()["periods"]
    assert periods[-1]["invoiceId"] is None
    assert (await _bill(client, auth_headers, project["id"], _months_ago(0))).status_code == 201


async def test_written_off_invoice_still_blocks_its_period(
    client, auth_headers, client_profile
):
    project = await _retainer_project(client, auth_headers, client_profile)
    inv = (await _bill(client, auth_headers, project["id"], _months_ago(0))).json()
    assert (
        await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    ).status_code == 200
    written_off = await client.post(
        f"{INVOICES_URL}/{inv['id']}/write-off",
        json={"reason": "Client vanished"},
        headers=auth_headers,
    )
    assert written_off.status_code == 200, written_off.text
    assert (await _bill(client, auth_headers, project["id"], _months_ago(0))).status_code == 409


async def test_database_blocks_double_billing_even_without_the_precheck(
    client, auth_headers, client_profile, db_session
):
    project = await _retainer_project(client, auth_headers, client_profile)
    inv = (await _bill(client, auth_headers, project["id"], _months_ago(0))).json()
    original = await db_session.get(Invoice, uuid.UUID(inv["id"]))

    now = datetime.now(UTC)
    dup = Invoice(
        invoice_number="DUP-1",
        issue_date=now,
        due_date=now,
        status=InvoiceStatus.DRAFT,
        currency=original.currency,
        freelancer_id=original.freelancer_id,
        client_id=original.client_id,
        project_id=original.project_id,
        retainer_period_start=original.retainer_period_start,
        subtotal=Decimal(1),
        total=Decimal(1),
    )
    db_session.add(dup)
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()
