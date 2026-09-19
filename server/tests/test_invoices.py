"""Tests for /api/v1/invoices, /invoices/{id}/payments and the invoice portal view."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.Milestone import MilestoneStatus
from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.TimeEntry import TimeEntry

INVOICES_URL = "/api/v1/invoices"
PORTAL_URL = "/api/v1/portal"


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _create(client, headers, project_id, **overrides):
    payload = {
        "projectId": str(project_id),
        "items": [{"description": "Design", "quantity": "10", "unitPrice": "100"}],
        **overrides,
    }
    return await client.post(INVOICES_URL, json=payload, headers=headers)


async def _create_ok(client, headers, project_id, **overrides):
    resp = await _create(client, headers, project_id, **overrides)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _send_ok(client, headers, invoice_id):
    resp = await client.post(f"{INVOICES_URL}/{invoice_id}/send", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _pay(client, headers, invoice_id, amount, **extra):
    return client.post(
        f"{INVOICES_URL}/{invoice_id}/payments",
        json={"amount": str(amount), **extra},
        headers=headers,
    )


async def _log_time(client, headers, project_id, minutes=120, **extra):
    end = datetime.now(timezone.utc) - timedelta(minutes=5)
    start = end - timedelta(minutes=minutes)
    resp = await client.post(
        "/api/v1/time-entries",
        json={
            "description": "Work",
            "startTime": _iso(start),
            "endTime": _iso(end),
            "isBillable": True,
            "projectId": str(project_id),
            **extra,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture
async def set_rate(client, auth_headers):
    async def _set(rate):
        resp = await client.patch("/api/v1/profile", json={"hourlyRate": str(rate)}, headers=auth_headers)
        assert resp.status_code == 200, resp.text

    return _set


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


async def test_create_invoice_requires_auth(client, project):
    resp = await _create(client, {}, project.id)
    assert resp.status_code == 401


async def test_create_invoice_computes_totals_and_defaults(client, auth_headers, project):
    body = await _create_ok(
        client, auth_headers, project.id, discountRate="10", taxRate="15"
    )
    assert body["invoiceNumber"] == "INV-0001"
    assert body["status"] == "DRAFT"
    assert body["displayStatus"] == "DRAFT"
    assert body["currency"] == "SAR"
    # 1000 - 10% = 900; +15% VAT = 1035
    assert Decimal(body["subtotal"]) == Decimal("1000.00")
    assert Decimal(body["discountAmount"]) == Decimal("100.00")
    assert Decimal(body["taxAmount"]) == Decimal("135.00")
    assert Decimal(body["total"]) == Decimal("1035.00")
    assert Decimal(body["amountPaid"]) == 0
    assert Decimal(body["balanceDue"]) == Decimal("1035.00")
    assert body["paymentAt"] is None  # an unpaid invoice must not claim a payment date
    assert body["sentAt"] is None and body["viewedAt"] is None
    issued = datetime.fromisoformat(body["issueDate"])
    assert datetime.fromisoformat(body["dueDate"]) - issued == timedelta(days=30)


async def test_invoice_numbers_are_sequential_and_per_freelancer(
    client, auth_headers, other_auth_headers, project, other_user,
    db_session, make_client_profile, make_project,
):
    first = await _create_ok(client, auth_headers, project.id)
    second = await _create_ok(client, auth_headers, project.id)
    assert (first["invoiceNumber"], second["invoiceNumber"]) == ("INV-0001", "INV-0002")

    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    other = await _create_ok(client, other_auth_headers, their_project.id)
    assert other["invoiceNumber"] == "INV-0001"  # numbering is per freelancer


async def test_create_invoice_uses_profile_business_identity_and_defaults(
    client, auth_headers, project
):
    resp = await client.patch(
        "/api/v1/profile",
        json={
            "businessName": "Acme Studio",
            "businessAddress": "1 King Fahd Rd, Riyadh",
            "vatNumber": "300000000000003",
            "currency": "usd",
            "defaultPaymentTermsDays": 14,
            "defaultTaxRate": "15",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    body = await _create_ok(client, auth_headers, project.id)
    assert body["issuer"]["businessName"] == "Acme Studio"
    assert body["issuer"]["vatNumber"] == "300000000000003"
    assert body["currency"] == "USD"
    assert Decimal(body["taxRate"]) == Decimal("15")
    issued = datetime.fromisoformat(body["issueDate"])
    assert datetime.fromisoformat(body["dueDate"]) - issued == timedelta(days=14)


async def test_client_payment_terms_override_freelancer_default(
    client, auth_headers, project, client_profile, db_session
):
    client_profile.payment_terms_days = 7
    client_profile.currency = "AED"
    await db_session.commit()
    body = await _create_ok(client, auth_headers, project.id)
    issued = datetime.fromisoformat(body["issueDate"])
    assert datetime.fromisoformat(body["dueDate"]) - issued == timedelta(days=7)
    assert body["currency"] == "AED"


async def test_create_invoice_needs_at_least_one_line(client, auth_headers, project):
    resp = await client.post(
        INVOICES_URL, json={"projectId": str(project.id)}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_create_invoice_rejects_due_before_issue(client, auth_headers, project):
    now = datetime.now(timezone.utc)
    resp = await _create(
        client, auth_headers, project.id,
        issueDate=_iso(now), dueDate=_iso(now - timedelta(days=1)),
    )
    assert resp.status_code == 422


async def test_create_invoice_for_another_freelancers_project_is_404(
    client, auth_headers, other_user, db_session, make_client_profile, make_project
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    resp = await _create(client, auth_headers, their_project.id)
    assert resp.status_code == 404


async def test_create_invoice_requires_freelancer_profile(client, make_user, project):
    from app.core.security import create_access_token

    plain = await make_user(email="nofl-invoice@example.com", with_freelancer=False)
    headers = {"Authorization": f"Bearer {create_access_token(plain.id)}"}
    resp = await _create(client, headers, project.id)
    assert resp.status_code == 403


async def test_money_validation(client, auth_headers, project):
    bad_items = [
        {"description": "x", "quantity": "1", "unitPrice": "-5"},
        {"description": "x", "quantity": "0", "unitPrice": "5"},
        {"description": "x", "quantity": "1", "unitPrice": "1.005"},
    ]
    for item in bad_items:
        resp = await _create(client, auth_headers, project.id, items=[item])
        assert resp.status_code == 422, item
    assert (await _create(client, auth_headers, project.id, taxRate="101")).status_code == 422
    assert (await _create(client, auth_headers, project.id, currency="RIYAL")).status_code == 422


# ---------------------------------------------------------------------------
# Billing sources: time entries and milestones
# ---------------------------------------------------------------------------


async def test_invoice_from_time_entries_uses_rate_snapshot_and_locks_entries(
    client, auth_headers, project, set_rate, db_session
):
    await set_rate(120)
    entry = await _log_time(client, auth_headers, project.id, minutes=120)
    assert Decimal(entry["hourlyRate"]) == Decimal("120.00")

    # Changing the rate afterwards must not rewrite history.
    await set_rate(200)

    body = await _create_ok(
        client, auth_headers, project.id, items=[], timeEntryIds=[entry["id"]]
    )
    assert Decimal(body["subtotal"]) == Decimal("240.00")  # 2h x 120
    assert body["items"][0]["timeEntryId"] == entry["id"]
    assert Decimal(body["items"][0]["quantity"]) == Decimal("2.00")

    db_entry = await db_session.get(TimeEntry, uuid.UUID(entry["id"]))
    await db_session.refresh(db_entry)
    assert db_entry.is_invoiced is True

    # The same entry cannot be billed twice.
    again = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[entry["id"]])
    assert again.status_code == 409


async def test_deleting_or_cancelling_an_invoice_releases_its_time_entries(
    client, auth_headers, project, set_rate, db_session
):
    await set_rate(100)
    e1 = await _log_time(client, auth_headers, project.id)
    e2 = await _log_time(client, auth_headers, project.id)

    draft = await _create_ok(client, auth_headers, project.id, items=[], timeEntryIds=[e1["id"]])
    resp = await client.delete(f"{INVOICES_URL}/{draft['id']}", headers=auth_headers)
    assert resp.status_code == 204

    sent = await _create_ok(client, auth_headers, project.id, items=[], timeEntryIds=[e1["id"], e2["id"]])
    await _send_ok(client, auth_headers, sent["id"])
    cancelled = await client.post(f"{INVOICES_URL}/{sent['id']}/cancel", headers=auth_headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"

    # Both are billable again.
    rebilled = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[e1["id"], e2["id"]])
    assert rebilled.status_code == 201, rebilled.text


async def test_time_entry_without_rate_cannot_be_invoiced(client, auth_headers, project):
    entry = await _log_time(client, auth_headers, project.id)  # no profile / project rate
    assert entry["hourlyRate"] is None
    resp = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[entry["id"]])
    assert resp.status_code == 422


async def test_running_and_non_billable_entries_cannot_be_invoiced(
    client, auth_headers, project, set_rate
):
    await set_rate(100)
    running = await client.post(
        "/api/v1/time-entries/start",
        json={"description": "live", "projectId": str(project.id)},
        headers=auth_headers,
    )
    assert running.status_code == 201
    resp = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[running.json()["id"]])
    assert resp.status_code == 409

    free = await _log_time(client, auth_headers, project.id, isBillable=False)
    resp = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[free["id"]])
    assert resp.status_code == 422


async def test_time_entries_from_another_project_are_refused(
    client, auth_headers, user, client_profile, project, make_project, set_rate
):
    await set_rate(100)
    other_project = await make_project(client_id=client_profile.id, created_by=user.id, name="Other")
    entry = await _log_time(client, auth_headers, other_project.id)
    resp = await _create(client, auth_headers, project.id, items=[], timeEntryIds=[entry["id"]])
    assert resp.status_code == 422


async def test_invoice_from_milestones(client, auth_headers, project, make_milestone):
    m1 = await make_milestone(project_id=project.id, name="Phase 1", amount=Decimal("500"))
    body = await _create_ok(
        client, auth_headers, project.id, items=[], milestoneIds=[str(m1.id)], taxRate="15"
    )
    assert Decimal(body["subtotal"]) == Decimal("500.00")
    assert Decimal(body["total"]) == Decimal("575.00")
    assert body["items"][0]["milestoneId"] == str(m1.id)

    # Already invoiced.
    again = await _create(client, auth_headers, project.id, items=[], milestoneIds=[str(m1.id)])
    assert again.status_code == 409


async def test_milestone_billing_rules(client, auth_headers, project, make_milestone):
    no_amount = await make_milestone(project_id=project.id, name="Free")
    resp = await _create(client, auth_headers, project.id, items=[], milestoneIds=[str(no_amount.id)])
    assert resp.status_code == 422

    unapproved = await make_milestone(
        project_id=project.id, name="Needs OK", amount=Decimal("100"), approval_required=True
    )
    resp = await _create(client, auth_headers, project.id, items=[], milestoneIds=[str(unapproved.id)])
    assert resp.status_code == 409

    approved = await make_milestone(
        project_id=project.id, name="OK", amount=Decimal("100"),
        approval_required=True, status=MilestoneStatus.APPROVED,
    )
    resp = await _create(client, auth_headers, project.id, items=[], milestoneIds=[str(approved.id)])
    assert resp.status_code == 201


async def test_invoiced_milestone_cannot_be_deleted(client, auth_headers, project, make_milestone):
    m = await make_milestone(project_id=project.id, amount=Decimal("100"))
    await _create_ok(client, auth_headers, project.id, items=[], milestoneIds=[str(m.id)])
    resp = await client.delete(f"/api/v1/milestones/{m.id}", headers=auth_headers)
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Read / list / edit
# ---------------------------------------------------------------------------


async def test_get_and_list_invoices_are_scoped_to_owner(
    client, auth_headers, other_auth_headers, project
):
    invoice = await _create_ok(client, auth_headers, project.id)
    assert (await client.get(f"{INVOICES_URL}/{invoice['id']}", headers=auth_headers)).status_code == 200
    assert (await client.get(f"{INVOICES_URL}/{invoice['id']}", headers=other_auth_headers)).status_code == 404

    mine = (await client.get(INVOICES_URL, headers=auth_headers)).json()
    theirs = (await client.get(INVOICES_URL, headers=other_auth_headers)).json()
    assert mine["total"] == 1 and theirs["total"] == 0


async def test_list_filters_and_pagination(client, auth_headers, project):
    for _ in range(3):
        await _create_ok(client, auth_headers, project.id)
    page = (await client.get(f"{INVOICES_URL}?skip=0&limit=2", headers=auth_headers)).json()
    assert page["total"] == 3 and len(page["invoices"]) == 2
    by_number = (await client.get(f"{INVOICES_URL}?search=0002", headers=auth_headers)).json()
    assert by_number["total"] == 1
    drafts = (await client.get(f"{INVOICES_URL}?status=DRAFT", headers=auth_headers)).json()
    assert drafts["total"] == 3
    assert (await client.get(f"{INVOICES_URL}?limit=101", headers=auth_headers)).status_code == 422
    assert (await client.get(f"{INVOICES_URL}?status=BOGUS", headers=auth_headers)).status_code == 422


async def test_update_draft_recomputes_totals_and_sent_is_immutable(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    resp = await client.patch(
        f"{INVOICES_URL}/{invoice['id']}",
        json={"taxRate": "15", "discountRate": "10", "notes": "Thanks"},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["total"]) == Decimal("1035.00")
    assert resp.json()["notes"] == "Thanks"

    await _send_ok(client, auth_headers, invoice["id"])
    locked = await client.patch(f"{INVOICES_URL}/{invoice['id']}", json={"notes": "x"}, headers=auth_headers)
    assert locked.status_code == 409
    deleted = await client.delete(f"{INVOICES_URL}/{invoice['id']}", headers=auth_headers)
    assert deleted.status_code == 409


# ---------------------------------------------------------------------------
# Send / remind / events
# ---------------------------------------------------------------------------


async def test_send_invoice_sets_lifecycle_and_logs_event(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    sent = await _send_ok(client, auth_headers, invoice["id"])
    assert sent["invoice"]["status"] == "SENT"
    assert sent["invoice"]["sentAt"] is not None
    assert f"/portal/invoices/{invoice['id']}?token=" in sent["portalUrl"]

    events = (await client.get(f"{INVOICES_URL}/{invoice['id']}/events", headers=auth_headers)).json()
    assert [e["eventType"] for e in events["events"]] == ["SENT"]

    # Re-send keeps state and the original sentAt.
    again = await _send_ok(client, auth_headers, invoice["id"])
    assert again["invoice"]["sentAt"] == sent["invoice"]["sentAt"]


async def test_send_requires_ownership_and_valid_state(
    client, auth_headers, other_auth_headers, project
):
    invoice = await _create_ok(client, auth_headers, project.id)
    assert (await client.post(f"{INVOICES_URL}/{invoice['id']}/send", headers=other_auth_headers)).status_code == 404
    await client.post(f"{INVOICES_URL}/{invoice['id']}/cancel", headers=auth_headers)
    assert (await client.post(f"{INVOICES_URL}/{invoice['id']}/send", headers=auth_headers)).status_code == 409


async def test_remind_only_for_open_invoices_and_is_rate_limited(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    assert (await client.post(f"{INVOICES_URL}/{invoice['id']}/remind", headers=auth_headers)).status_code == 409

    await _send_ok(client, auth_headers, invoice["id"])
    first = await client.post(f"{INVOICES_URL}/{invoice['id']}/remind", headers=auth_headers)
    assert first.status_code == 200, first.text
    second = await client.post(f"{INVOICES_URL}/{invoice['id']}/remind", headers=auth_headers)
    assert second.status_code == 429

    events = (await client.get(f"{INVOICES_URL}/{invoice['id']}/events", headers=auth_headers)).json()
    assert [e["eventType"] for e in events["events"]] == ["SENT", "REMINDED"]
    assert events["events"][1]["detail"] == "Reminder #1"


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


async def test_payment_lifecycle_partial_then_paid(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)  # total 1000
    await _send_ok(client, auth_headers, invoice["id"])

    part = await _pay(client, auth_headers, invoice["id"], "400", method="CARD", reference="TX-1")
    assert part.status_code == 201, part.text
    body = part.json()
    assert body["status"] == "PARTIALLY_PAID"
    assert body["paymentAt"] is None
    assert Decimal(body["amountPaid"]) == Decimal("400.00")
    assert Decimal(body["balanceDue"]) == Decimal("600.00")
    assert body["payments"][0]["method"] == "CARD"

    rest = await _pay(client, auth_headers, invoice["id"], "600")
    assert rest.json()["status"] == "PAID"
    assert rest.json()["paymentAt"] is not None
    assert Decimal(rest.json()["balanceDue"]) == 0

    events = (await client.get(f"{INVOICES_URL}/{invoice['id']}/events", headers=auth_headers)).json()
    assert [e["eventType"] for e in events["events"]] == [
        "SENT", "PAYMENT_RECORDED", "PAYMENT_RECORDED", "PAID",
    ]

    listed = await client.get(f"{INVOICES_URL}/{invoice['id']}/payments", headers=auth_headers)
    assert len(listed.json()) == 2


async def test_payment_rules(client, auth_headers, other_auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    # Draft: must be sent first.
    assert (await _pay(client, auth_headers, invoice["id"], "10")).status_code == 409

    await _send_ok(client, auth_headers, invoice["id"])
    assert (await _pay(client, auth_headers, invoice["id"], "1000.01")).status_code == 422  # overpay
    assert (await _pay(client, auth_headers, invoice["id"], "0")).status_code == 422
    assert (await _pay(client, auth_headers, invoice["id"], "-5")).status_code == 422
    future = _iso(datetime.now(timezone.utc) + timedelta(days=2))
    assert (await _pay(client, auth_headers, invoice["id"], "10", paidAt=future)).status_code == 422
    assert (await _pay(client, other_auth_headers, invoice["id"], "10")).status_code == 404

    await _pay(client, auth_headers, invoice["id"], "1000")
    assert (await _pay(client, auth_headers, invoice["id"], "1")).status_code == 409  # already paid


async def test_void_payment_rederives_status(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    await _send_ok(client, auth_headers, invoice["id"])
    p1 = (await _pay(client, auth_headers, invoice["id"], "400")).json()["payments"][0]
    paid = (await _pay(client, auth_headers, invoice["id"], "600")).json()
    assert paid["status"] == "PAID"

    resp = await client.delete(
        f"{INVOICES_URL}/{invoice['id']}/payments/{paid['payments'][1]['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "PARTIALLY_PAID" and resp.json()["paymentAt"] is None

    resp = await client.delete(
        f"{INVOICES_URL}/{invoice['id']}/payments/{p1['id']}", headers=auth_headers
    )
    assert resp.json()["status"] == "SENT"
    missing = await client.delete(
        f"{INVOICES_URL}/{invoice['id']}/payments/{uuid.uuid4()}", headers=auth_headers
    )
    assert missing.status_code == 404


async def test_overdue_is_derived_not_stored(client, auth_headers, project):
    now = datetime.now(timezone.utc)
    invoice = await _create_ok(
        client, auth_headers, project.id,
        issueDate=_iso(now - timedelta(days=40)), dueDate=_iso(now - timedelta(days=10)),
    )
    assert invoice["displayStatus"] == "DRAFT"  # drafts are never overdue
    sent = (await _send_ok(client, auth_headers, invoice["id"]))["invoice"]
    assert sent["status"] == "SENT"  # stored status stays SENT
    assert sent["isOverdue"] is True and sent["displayStatus"] == "OVERDUE"

    # Overdue can coexist with part payment: derived, so nothing conflicts.
    part = (await _pay(client, auth_headers, invoice["id"], "100")).json()
    assert part["status"] == "PARTIALLY_PAID"
    assert part["isOverdue"] is True and part["displayStatus"] == "OVERDUE"

    overdue = (await client.get(f"{INVOICES_URL}?status=OVERDUE", headers=auth_headers)).json()
    assert overdue["total"] == 1
    partially = (await client.get(f"{INVOICES_URL}?status=PARTIALLY_PAID", headers=auth_headers)).json()
    assert partially["total"] == 0  # it is overdue, so it is listed as such

    done = (await _pay(client, auth_headers, invoice["id"], "900")).json()
    assert done["status"] == "PAID" and done["isOverdue"] is False


async def test_cancel_rules(client, auth_headers, project):
    paid_invoice = await _create_ok(client, auth_headers, project.id)
    await _send_ok(client, auth_headers, paid_invoice["id"])
    await _pay(client, auth_headers, paid_invoice["id"], "1000")
    assert (await client.post(f"{INVOICES_URL}/{paid_invoice['id']}/cancel", headers=auth_headers)).status_code == 409

    part = await _create_ok(client, auth_headers, project.id)
    await _send_ok(client, auth_headers, part["id"])
    await _pay(client, auth_headers, part["id"], "100")
    assert (await client.post(f"{INVOICES_URL}/{part['id']}/cancel", headers=auth_headers)).status_code == 409

    fresh = await _create_ok(client, auth_headers, project.id)
    ok = await client.post(f"{INVOICES_URL}/{fresh['id']}/cancel", headers=auth_headers)
    assert ok.status_code == 200 and Decimal(ok.json()["balanceDue"]) == 0
    assert (await client.post(f"{INVOICES_URL}/{fresh['id']}/cancel", headers=auth_headers)).status_code == 409


# ---------------------------------------------------------------------------
# Client portal view
# ---------------------------------------------------------------------------


def _token_from(portal_url: str) -> str:
    return portal_url.split("token=", 1)[1]


async def test_portal_invoice_view_stamps_viewed_at_once(client, auth_headers, project, db_session):
    invoice = await _create_ok(client, auth_headers, project.id)
    sent = await _send_ok(client, auth_headers, invoice["id"])
    token = _token_from(sent["portalUrl"])

    first = await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": token})
    assert first.status_code == 200, first.text
    assert first.json()["viewedAt"] is not None
    await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": token})

    events = (await client.get(f"{INVOICES_URL}/{invoice['id']}/events", headers=auth_headers)).json()
    assert [e["eventType"] for e in events["events"]] == ["SENT", "VIEWED"]

    record = (await db_session.execute(select(PortalAccessToken))).scalar_one()
    assert record.scope_type == ScopeType.INVOICE
    assert record.last_used_at is not None  # "did the client ever open the link?"


async def test_portal_invoice_scope_is_enforced(
    client, auth_headers, project, client_profile, make_portal_token
):
    invoice = await _create_ok(client, auth_headers, project.id)
    await _send_ok(client, auth_headers, invoice["id"])

    project_token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": project_token})
    assert resp.status_code == 403

    other_invoice_token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.INVOICE, scope=uuid.uuid4()
    )
    resp = await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": other_invoice_token})
    assert resp.status_code == 403
    assert (await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}")).status_code == 401


async def test_draft_invoice_is_not_visible_in_portal(
    client, auth_headers, project, client_profile, make_portal_token
):
    invoice = await _create_ok(client, auth_headers, project.id)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.INVOICE, scope=uuid.UUID(invoice["id"])
    )
    resp = await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": token})
    assert resp.status_code == 404


async def test_cancelling_revokes_the_client_link(client, auth_headers, project):
    invoice = await _create_ok(client, auth_headers, project.id)
    token = _token_from((await _send_ok(client, auth_headers, invoice["id"]))["portalUrl"])
    await client.post(f"{INVOICES_URL}/{invoice['id']}/cancel", headers=auth_headers)
    resp = await client.get(f"{PORTAL_URL}/invoice/{invoice['id']}", params={"token": token})
    assert resp.status_code == 401
