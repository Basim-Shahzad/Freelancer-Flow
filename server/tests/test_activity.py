"""Audit-log completeness (Step 15): redaction, coarse time logging, feed paging, full flow."""

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.crud.activity import REDACTED, redact_changes
from app.models.ActivityEvent import ActivityEvent

ACTIVITY_URL = "/api/v1/activity"
PM_URL = "/api/v1/payment-methods"
TIME_URL = "/api/v1/time-entries"
IBAN = "PK36SCBL0000001123456702"


async def _rows(db_session):
    result = await db_session.execute(
        select(ActivityEvent).order_by(ActivityEvent.created_at, ActivityEvent.id)
    )
    return list(result.scalars())


def _entry(project_id, hours_ago=3, minutes=60):
    start = datetime.now(UTC) - timedelta(hours=hours_ago)
    return {
        "description": "Work",
        "startTime": start.isoformat(),
        "endTime": (start + timedelta(minutes=minutes)).isoformat(),
        "isBillable": True,
        "projectId": str(project_id),
    }


def test_redact_changes_masks_every_secret_field_including_nested():
    out = redact_changes(
        {
            "details": {"old": {"iban": IBAN}, "new": {"iban": "x"}},
            "tax_id": {"old": "1", "new": "2"},
            "hashed_password": {"old": "a", "new": "b"},
            "token": {"old": "a", "new": "b"},
            "refresh_token": {"old": "a", "new": "b"},
            "nested": {"jti": {"old": "a", "new": "b"}, "name": {"old": "A", "new": "B"}},
            "name": {"old": "A", "new": "B"},
        }
    )
    for key in ("details", "tax_id", "hashed_password", "token", "refresh_token"):
        assert out[key] == {"old": REDACTED, "new": REDACTED}
    assert out["nested"]["jti"] == {"old": REDACTED, "new": REDACTED}
    assert out["nested"]["name"] == {"old": "A", "new": "B"}
    assert out["name"] == {"old": "A", "new": "B"}
    assert redact_changes(None) is None


async def test_routine_timer_actions_write_no_rows(client, auth_headers, project, db_session):
    start = await client.post(
        f"{TIME_URL}/start", json={"projectId": str(project.id), "description": "x"}, headers=auth_headers
    )
    assert start.status_code == 201, start.text
    entry_id = start.json()["id"]
    assert (await client.post(f"{TIME_URL}/entry/{entry_id}/stop", headers=auth_headers)).status_code == 200
    assert (await client.post(TIME_URL, json=_entry(project.id), headers=auth_headers)).status_code == 201
    assert (
        await client.patch(f"{TIME_URL}/entry/{entry_id}", json={"description": "y"}, headers=auth_headers)
    ).status_code == 200
    assert [r for r in await _rows(db_session) if r.entity_type == "time_entry"] == []


async def test_deleting_a_time_entry_is_logged(client, auth_headers, project, db_session):
    created = (await client.post(TIME_URL, json=_entry(project.id), headers=auth_headers)).json()
    assert (await client.delete(f"{TIME_URL}/entry/{created['id']}", headers=auth_headers)).status_code == 204
    assert [(r.entity_type, r.action) for r in await _rows(db_session)] == [("time_entry", "deleted")]


async def test_client_create_and_delete_are_logged(client, auth_headers, freelancer_profile, db_session):
    resp = await client.post(
        "/api/v1/clients", json={"name": "Acme", "email": "acme@example.com"}, headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    assert (await client.delete(f"/api/v1/clients/{resp.json()['id']}", headers=auth_headers)).status_code == 204
    assert [(r.entity_type, r.action) for r in await _rows(db_session)] == [
        ("client", "created"),
        ("client", "deleted"),
    ]


async def test_feed_filters_and_cursor_paging(client, auth_headers, project):
    for i in range(5):
        await client.patch(f"/api/v1/projects/{project.id}", json={"name": f"N{i}"}, headers=auth_headers)

    seen, cursor = [], None
    for _ in range(5):
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        page = (await client.get(ACTIVITY_URL, params=params, headers=auth_headers)).json()
        assert page["total"] == 5
        seen += [e["id"] for e in page["events"]]
        cursor = page["nextCursor"]
        if cursor is None:
            break
    assert len(seen) == 5 and len(set(seen)) == 5

    full = (await client.get(ACTIVITY_URL, headers=auth_headers)).json()
    assert [e["id"] for e in full["events"]] == seen and full["nextCursor"] is None

    by_entity = await client.get(
        ACTIVITY_URL, params={"entity_type": "project", "entity_id": str(project.id)}, headers=auth_headers
    )
    assert by_entity.json()["total"] == 5
    missing = {"entity_id": "00000000-0000-0000-0000-000000000001"}
    assert (await client.get(ACTIVITY_URL, params=missing, headers=auth_headers)).json()["total"] == 0

    now = datetime.now(UTC)
    window = {"from": (now - timedelta(minutes=5)).isoformat(), "to": (now + timedelta(minutes=5)).isoformat()}
    assert (await client.get(ACTIVITY_URL, params=window, headers=auth_headers)).json()["total"] == 5
    before = {"to": (now - timedelta(days=1)).isoformat()}
    assert (await client.get(ACTIVITY_URL, params=before, headers=auth_headers)).json()["total"] == 0
    assert (await client.get(ACTIVITY_URL, params={"cursor": "garbage"}, headers=auth_headers)).status_code == 422


async def test_full_flow_writes_expected_activity_and_no_secrets(client, auth_headers, freelancer_profile, db_session):
    h = auth_headers
    c = (await client.post("/api/v1/clients", json={"name": "Acme", "email": "acme@example.com"}, headers=h)).json()
    p = await client.post(
        "/api/v1/projects", json={"name": "Site", "clientId": c["id"], "hourlyRate": "100"}, headers=h
    )
    assert p.status_code == 201, p.text
    pid = p.json()["id"]

    pm = await client.post(
        PM_URL,
        json={
            "type": "PKR_BANK_TRANSFER",
            "label": "Main",
            "details": {"accountTitle": "Ali", "bankName": "Meezan", "iban": IBAN},
        },
        headers=h,
    )
    assert pm.status_code == 201, pm.text

    entry_id = (await client.post(TIME_URL, json=_entry(pid), headers=h)).json()["id"]
    inv = await client.post(
        "/api/v1/invoices",
        json={"projectId": pid, "timeEntryIds": [entry_id], "paymentMethodIds": [pm.json()["id"]]},
        headers=h,
    )
    assert inv.status_code == 201, inv.text
    iid = inv.json()["id"]
    sent = await client.post(f"/api/v1/invoices/{iid}/send", headers=h)
    assert sent.status_code == 200, sent.text
    pay = await client.post(f"/api/v1/invoices/{iid}/payments", json={"amount": "10"}, headers=h)
    assert pay.status_code == 201, pay.text
    assert (await client.post(f"/api/v1/invoices/{iid}/write-off", json={"reason": "gone"}, headers=h)).status_code == 200
    rev = await client.post(f"/api/v1/invoices/{iid}/reverse-write-off", headers=h)
    assert rev.status_code == 200, rev.text
    assert rev.json()["status"] == "PARTIALLY_PAID"
    payment_id = rev.json()["payments"][0]["id"]
    assert (await client.delete(f"/api/v1/invoices/{iid}/payments/{payment_id}", headers=h)).status_code == 200

    rows = await _rows(db_session)
    assert [(r.entity_type, r.action) for r in rows] == [
        ("client", "created"),
        ("project", "created"),
        ("payment_method", "created"),
        ("time_entry", "linked"),
        ("invoice", "created"),
        ("invoice", "sent"),
        ("invoice", "payment_recorded"),
        ("invoice", "written_off"),
        ("invoice", "write_off_reversed"),
        ("invoice", "payment_voided"),
    ]

    blob = json.dumps([[r.summary, r.changes] for r in rows])
    assert IBAN not in blob and "Meezan" not in blob
    link = next(r for r in rows if r.action == "linked")
    assert link.changes["count"] == 1 and link.changes["invoice_id"] == iid
