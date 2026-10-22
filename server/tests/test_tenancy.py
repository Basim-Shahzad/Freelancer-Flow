"""Cross-tenant isolation: user B must never read or change user A's data.

Three families, each over every resource: ids in the URL, foreign ids inside
request bodies, and portal-token scope.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models.PortalAccessToken import ScopeType

API = "/api/v1"
PORTAL = f"{API}/portal"
GHOST = uuid.uuid4()

PK_IBAN_FREE_METHOD = {
    "type": "OTHER",
    "label": "Cash",
    "details": {"instructions": "Pay in person"},
}


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _times():
    end = datetime.now(timezone.utc) - timedelta(minutes=5)
    return (end - timedelta(hours=1)).isoformat(), end.isoformat()


@pytest.fixture
async def world(client, auth_headers, project, milestone, client_profile, db_session):
    """User A's data, created through the API where a route exists."""
    start, end = _times()
    entry = (
        await client.post(
            f"{API}/time-entries",
            json={
                "description": "Work",
                "startTime": start,
                "endTime": end,
                "projectId": str(project.id),
                "isBillable": True,
            },
            headers=auth_headers,
        )
    ).json()
    invoice = (
        await client.post(
            f"{API}/invoices",
            json={
                "projectId": str(project.id),
                "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
            },
            headers=auth_headers,
        )
    ).json()
    sent = await client.post(f"{API}/invoices/{invoice['id']}/send", headers=auth_headers)
    assert sent.status_code == 200, sent.text
    payment = await client.post(
        f"{API}/invoices/{invoice['id']}/payments", json={"amount": "10"}, headers=auth_headers
    )
    assert payment.status_code == 201, payment.text
    method = (
        await client.post(f"{API}/payment-methods", json=PK_IBAN_FREE_METHOD, headers=auth_headers)
    )
    assert method.status_code == 201, method.text
    expense = (
        await client.post(
            f"{API}/expenses",
            json={"description": "Figma", "amount": "10", "incurredOn": date.today().isoformat()},
            headers=auth_headers,
        )
    ).json()
    change_request = (
        await client.post(
            f"{API}/change-requests",
            json={"projectId": str(project.id), "title": "More pages"},
            headers=auth_headers,
        )
    ).json()
    remittance = (
        await client.post(
            f"{API}/tax/remittances",
            json={"periodStart": "2026-01-01", "periodEnd": "2026-03-31", "amount": "10"},
            headers=auth_headers,
        )
    ).json()
    return {
        "client": client_profile,
        "project": project,
        "milestone": milestone,
        "entry": entry,
        "invoice": invoice,
        "payment": payment.json()["payments"][0] if "payments" in payment.json() else None,
        "method": method.json(),
        "expense": expense,
        "change_request": change_request,
        "remittance": remittance,
    }


@pytest.fixture
async def b_project(db_session, other_user, make_client_profile, make_project):
    """User B's own client and project, so body-id attacks pass every other check."""
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    b_client = await make_client_profile(freelancer_id=other_user.freelancer.id, name="B Client")
    return await make_project(client_id=b_client.id, created_by=other_user.id, name="B Project")


# ---------------------------------------------------------------------------
# 1. Ids in the URL
# ---------------------------------------------------------------------------

URL_CASES = [
    ("GET", "/clients/{client}", None),
    ("PATCH", "/clients/{client}", {"name": "pwned"}),
    ("DELETE", "/clients/{client}", None),
    ("GET", "/projects/{project}", None),
    ("PATCH", "/projects/{project}", {"name": "pwned"}),
    ("DELETE", "/projects/{project}", None),
    ("GET", "/projects/{project}/retainer-periods", None),
    ("GET", "/projects/{project}/milestones/", None),
    ("PUT", "/projects/{project}/milestones/order", {"milestoneIds": [str(GHOST)]}),
    ("GET", "/time-entries/{project}", None),
    ("PATCH", "/time-entries/entry/{entry}", {"description": "pwned"}),
    ("POST", "/time-entries/entry/{entry}/stop", None),
    ("DELETE", "/time-entries/entry/{entry}", None),
    ("GET", "/milestones/{milestone}", None),
    ("PATCH", "/milestones/{milestone}", {"name": "pwned"}),
    ("DELETE", "/milestones/{milestone}", None),
    ("POST", "/milestones/{milestone}/submit", None),
    ("GET", "/change-requests/{change_request}", None),
    ("PATCH", "/change-requests/{change_request}", {"title": "pwned"}),
    ("DELETE", "/change-requests/{change_request}", None),
    ("GET", "/invoices/{invoice}", None),
    ("GET", "/invoices/{invoice}/pdf", None),
    ("PATCH", "/invoices/{invoice}", {"taxNote": "pwned"}),
    ("DELETE", "/invoices/{invoice}", None),
    ("POST", "/invoices/{invoice}/send", None),
    ("POST", "/invoices/{invoice}/remind", None),
    ("GET", "/invoices/{invoice}/share", None),
    ("POST", "/invoices/{invoice}/cancel", None),
    ("POST", "/invoices/{invoice}/write-off", {"reason": "pwned"}),
    ("POST", "/invoices/{invoice}/reverse-write-off", None),
    ("GET", "/invoices/{invoice}/events", None),
    ("GET", "/invoices/{invoice}/payments", None),
    ("POST", "/invoices/{invoice}/payments", {"amount": "1"}),
    ("DELETE", "/invoices/{invoice}/payments/{payment}", None),
    ("GET", "/payment-methods/{method}", None),
    ("PATCH", "/payment-methods/{method}", {"label": "pwned"}),
    ("DELETE", "/payment-methods/{method}", None),
    ("GET", "/expenses/{expense}", None),
    ("PATCH", "/expenses/{expense}", {"description": "pwned"}),
    ("DELETE", "/expenses/{expense}", None),
    ("DELETE", "/tax/remittances/{remittance}", None),
]


def _fill(template: str, world: dict) -> str:
    return template.format(
        client=world["client"].id,
        project=world["project"].id,
        milestone=world["milestone"].id,
        entry=world["entry"]["id"],
        invoice=world["invoice"]["id"],
        payment=(world["payment"] or {}).get("id", GHOST),
        method=world["method"]["id"],
        expense=world["expense"]["id"],
        change_request=world["change_request"]["id"],
        remittance=world["remittance"]["id"],
    )


@pytest.mark.parametrize("method,template,body", URL_CASES)
async def test_foreign_url_id_is_404(client, other_auth_headers, world, method, template, body):
    resp = await client.request(
        method, f"{API}{_fill(template, world)}", json=body, headers=other_auth_headers
    )
    assert resp.status_code == 404, f"{method} {template}: {resp.status_code} {resp.text}"


@pytest.mark.parametrize(
    "template", [t for m, t, _ in URL_CASES if m == "GET" and "retainer" not in t]
)
async def test_get_url_cases_work_for_the_owner(client, auth_headers, world, template):
    """Guards the cases above: a 404 for B only means something if A gets past it."""
    resp = await client.get(f"{API}{_fill(template, world)}", headers=auth_headers)
    assert resp.status_code == 200, f"{template}: {resp.status_code} {resp.text}"


async def test_owner_data_untouched_after_attacks(client, auth_headers, other_auth_headers, world):
    for method, template, body in URL_CASES:
        await client.request(
            method, f"{API}{_fill(template, world)}", json=body, headers=other_auth_headers
        )
    invoice = (await client.get(f"{API}/invoices/{world['invoice']['id']}", headers=auth_headers)).json()
    assert invoice["status"] != "CANCELLED" and invoice["taxNote"] != "pwned"
    project = (await client.get(f"{API}/projects/{world['project'].id}", headers=auth_headers)).json()
    assert project["name"] == "Website Revamp"
    assert (await client.get(f"{API}/clients/{world['client'].id}", headers=auth_headers)).status_code == 200


# ---------------------------------------------------------------------------
# 2. Lists are scoped to the owner
# ---------------------------------------------------------------------------

LIST_CASES = [
    ("/clients", "clients"),
    ("/projects", "projects"),
    ("/invoices", "invoices"),
    ("/expenses", "expenses"),
    ("/change-requests", "changeRequests"),
    ("/tax/remittances", "remittances"),
    ("/payment-methods", "paymentMethods"),
]


@pytest.mark.parametrize("path,key", LIST_CASES)
async def test_lists_hide_foreign_rows(client, auth_headers, other_auth_headers, world, path, key):
    mine = await client.get(f"{API}{path}", headers=auth_headers)
    assert mine.status_code == 200 and mine.json()[key], f"fixture missing for {path}"
    theirs = await client.get(f"{API}{path}", headers=other_auth_headers)
    assert theirs.status_code == 200
    assert theirs.json()[key] == []
    if "total" in theirs.json():
        assert theirs.json()["total"] == 0


async def test_activity_and_dashboard_hide_foreign_rows(client, other_auth_headers, world):
    activity = (await client.get(f"{API}/activity", headers=other_auth_headers)).json()
    assert activity["events"] == [] and activity["total"] == 0
    dashboard = await client.get(f"{API}/dashboard/summary", headers=other_auth_headers)
    assert dashboard.status_code == 200
    assert str(world["project"].id) not in dashboard.text
    assert world["invoice"]["invoiceNumber"] not in dashboard.text


async def test_activity_entity_filter_cannot_reach_foreign_rows(
    client, other_auth_headers, world
):
    resp = await client.get(
        f"{API}/activity",
        params={"entityType": "invoice", "entityId": world["invoice"]["id"]},
        headers=other_auth_headers,
    )
    assert resp.status_code == 200 and resp.json()["events"] == []


async def test_running_timer_is_not_shared(client, auth_headers, other_auth_headers, project):
    started = await client.post(
        f"{API}/time-entries/start",
        json={"description": "Live", "projectId": str(project.id)},
        headers=auth_headers,
    )
    assert started.status_code == 201, started.text
    resp = await client.get(f"{API}/time-entries/running", headers=other_auth_headers)
    assert resp.status_code == 200 and resp.json() in (None, {}) or resp.json().get("id") is None


# ---------------------------------------------------------------------------
# 3. Foreign ids inside request bodies (B owns every other referenced object)
# ---------------------------------------------------------------------------


def _is_refused(resp) -> bool:
    return resp.status_code in (404, 422)


async def test_time_entry_create_with_foreign_project_or_milestone(
    client, other_auth_headers, world, b_project
):
    start, end = _times()
    base = {"description": "x", "startTime": start, "endTime": end}
    foreign_project = await client.post(
        f"{API}/time-entries",
        json={**base, "projectId": str(world["project"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(foreign_project), foreign_project.text
    foreign_milestone = await client.post(
        f"{API}/time-entries",
        json={**base, "projectId": str(b_project.id), "milestoneId": str(world["milestone"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(foreign_milestone), foreign_milestone.text
    start_timer = await client.post(
        f"{API}/time-entries/start",
        json={"description": "x", "projectId": str(world["project"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(start_timer), start_timer.text


async def test_time_bulk_and_sync_with_foreign_ids(
    client, auth_headers, other_auth_headers, world, b_project
):
    entry_id = world["entry"]["id"]
    bulk = await client.patch(
        f"{API}/time-entries/bulk",
        json={"ids": [entry_id], "set": {"description": "pwned"}},
        headers=other_auth_headers,
    )
    assert _is_refused(bulk)
    move = await client.patch(
        f"{API}/time-entries/bulk",
        json={"ids": [entry_id], "set": {"projectId": str(world["project"].id)}},
        headers=other_auth_headers,
    )
    assert _is_refused(move)
    start, end = _times()
    sync = await client.post(
        f"{API}/time-entries/sync",
        json={
            "entries": [
                {  # new entry pointing at A's project
                    "id": str(uuid.uuid4()),
                    "startTime": start,
                    "endTime": end,
                    "projectId": str(world["project"].id),
                },
                {  # B's own id colliding with A's existing entry
                    "id": entry_id,
                    "startTime": start,
                    "endTime": end,
                    "projectId": str(b_project.id),
                    "deleted": True,
                },
            ]
        },
        headers=other_auth_headers,
    )
    assert sync.status_code == 200, sync.text
    assert all(r["status"] in ("rejected", "conflict") for r in sync.json()["results"])
    still = await client.get(f"{API}/time-entries/{world['project'].id}", headers=auth_headers)
    assert [e["id"] for e in still.json()["timeEntries"]] == [entry_id]
    assert still.json()["timeEntries"][0]["description"] == "Work"


async def test_milestone_and_change_request_with_foreign_project(
    client, other_auth_headers, world
):
    milestone = await client.post(
        f"{API}/milestones",
        json={"name": "x", "projectId": str(world["project"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(milestone)
    change = await client.post(
        f"{API}/change-requests",
        json={"projectId": str(world["project"].id), "title": "x"},
        headers=other_auth_headers,
    )
    assert _is_refused(change)


async def test_project_with_foreign_client(
    client, auth_headers, other_auth_headers, world, b_project
):
    create = await client.post(
        f"{API}/projects",
        json={"name": "x", "clientId": str(world["client"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(create)
    move = await client.patch(
        f"{API}/projects/{b_project.id}",
        json={"clientId": str(world["client"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(move)
    mine = (await client.get(f"{API}/projects", headers=auth_headers)).json()
    assert [p["name"] for p in mine["projects"]] == ["Website Revamp"]


async def test_expense_with_foreign_project(client, other_auth_headers, world):
    body = {"description": "x", "amount": "5", "incurredOn": date.today().isoformat()}
    created = await client.post(
        f"{API}/expenses",
        json={**body, "projectId": str(world["project"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(created)
    mine = await client.post(f"{API}/expenses", json=body, headers=other_auth_headers)
    assert mine.status_code == 201, mine.text
    moved = await client.patch(
        f"{API}/expenses/{mine.json()['id']}",
        json={"projectId": str(world["project"].id)},
        headers=other_auth_headers,
    )
    assert _is_refused(moved)


async def test_invoice_create_with_foreign_ids(
    client, other_auth_headers, world, b_project
):
    items = [{"description": "x", "quantity": "1", "unitPrice": "1"}]
    cases = {
        "project": {"projectId": str(world["project"].id), "items": items},
        "time entry": {
            "projectId": str(b_project.id),
            "items": items,
            "timeEntryIds": [world["entry"]["id"]],
        },
        "milestone": {
            "projectId": str(b_project.id),
            "items": items,
            "milestoneIds": [str(world["milestone"].id)],
        },
        "payment method": {
            "projectId": str(b_project.id),
            "items": items,
            "paymentMethodIds": [world["method"]["id"]],
        },
    }
    for name, payload in cases.items():
        resp = await client.post(f"{API}/invoices", json=payload, headers=other_auth_headers)
        assert _is_refused(resp), f"{name}: {resp.status_code} {resp.text}"
    listing = (await client.get(f"{API}/invoices", headers=other_auth_headers)).json()
    assert listing["total"] == 0


async def test_invoice_update_with_foreign_payment_method(
    client, other_auth_headers, world, b_project
):
    created = await client.post(
        f"{API}/invoices",
        json={
            "projectId": str(b_project.id),
            "items": [{"description": "x", "quantity": "1", "unitPrice": "1"}],
        },
        headers=other_auth_headers,
    )
    assert created.status_code == 201, created.text
    resp = await client.patch(
        f"{API}/invoices/{created.json()['id']}",
        json={"paymentMethodIds": [world["method"]["id"]]},
        headers=other_auth_headers,
    )
    assert _is_refused(resp), resp.text


async def test_payment_method_order_with_foreign_id(
    client, other_auth_headers, world
):
    resp = await client.put(
        f"{API}/payment-methods/order",
        json={"ids": [world["method"]["id"]]},
        headers=other_auth_headers,
    )
    assert _is_refused(resp)


async def test_invoiced_time_entry_of_a_is_not_consumed_by_b(
    client, auth_headers, other_auth_headers, world, b_project
):
    await client.post(
        f"{API}/invoices",
        json={
            "projectId": str(b_project.id),
            "items": [{"description": "x", "quantity": "1", "unitPrice": "1"}],
            "timeEntryIds": [world["entry"]["id"]],
        },
        headers=other_auth_headers,
    )
    entries = (await client.get(f"{API}/time-entries/{world['project'].id}", headers=auth_headers)).json()
    assert entries["timeEntries"][0].get("invoiceId") in (None, "")


# ---------------------------------------------------------------------------
# 4. Portal token scope
# ---------------------------------------------------------------------------


@pytest.fixture
async def b_invoice(client, other_auth_headers, b_project, db_session):
    created = await client.post(
        f"{API}/invoices",
        json={
            "projectId": str(b_project.id),
            "items": [{"description": "x", "quantity": "1", "unitPrice": "5"}],
        },
        headers=other_auth_headers,
    )
    assert created.status_code == 201, created.text
    sent = await client.post(f"{API}/invoices/{created.json()['id']}/send", headers=other_auth_headers)
    assert sent.status_code == 200, sent.text
    return created.json()


async def test_portal_invoice_token_cannot_read_another_clients_invoice(
    client, world, b_invoice, make_portal_token
):
    token, _ = await make_portal_token(
        client_id=world["client"].id,
        scope_type=ScopeType.INVOICE,
        scope=uuid.UUID(world["invoice"]["id"]),
    )
    mine = await client.get(f"{PORTAL}/invoice/{world['invoice']['id']}", headers=_auth(token))
    assert mine.status_code == 200, mine.text
    for suffix in ("", "/pdf"):
        other = await client.get(f"{PORTAL}/invoice/{b_invoice['id']}{suffix}", headers=_auth(token))
        assert other.status_code == 403, f"{suffix or 'view'}: {other.status_code}"


async def test_portal_token_scoped_to_foreign_invoice_still_filtered_by_client(
    client, world, b_invoice, make_portal_token
):
    """Even a token whose scope names B's invoice cannot read it as client A."""
    token, _ = await make_portal_token(
        client_id=world["client"].id,
        scope_type=ScopeType.INVOICE,
        scope=uuid.UUID(b_invoice["id"]),
    )
    for suffix in ("", "/pdf"):
        resp = await client.get(f"{PORTAL}/invoice/{b_invoice['id']}{suffix}", headers=_auth(token))
        assert resp.status_code == 404, f"{suffix or 'view'}: {resp.status_code}"


async def test_portal_invoice_token_cannot_read_a_sibling_invoice_of_same_client(
    client, auth_headers, world, make_portal_token
):
    second = (
        await client.post(
            f"{API}/invoices",
            json={
                "projectId": str(world["project"].id),
                "items": [{"description": "y", "quantity": "1", "unitPrice": "7"}],
            },
            headers=auth_headers,
        )
    ).json()
    await client.post(f"{API}/invoices/{second['id']}/send", headers=auth_headers)
    token, _ = await make_portal_token(
        client_id=world["client"].id,
        scope_type=ScopeType.INVOICE,
        scope=uuid.UUID(world["invoice"]["id"]),
    )
    for suffix in ("", "/pdf"):
        resp = await client.get(f"{PORTAL}/invoice/{second['id']}{suffix}", headers=_auth(token))
        assert resp.status_code == 403


async def test_portal_project_and_milestone_scope(
    client, world, b_project, make_portal_token, make_milestone
):
    b_milestone = await make_milestone(project_id=b_project.id)
    token, _ = await make_portal_token(
        client_id=world["client"].id, scope_type=ScopeType.PROJECT, scope=world["project"].id
    )
    assert (await client.get(f"{PORTAL}/project/{world['project'].id}", headers=_auth(token))).status_code == 200
    assert (await client.get(f"{PORTAL}/project/{b_project.id}", headers=_auth(token))).status_code == 403
    assert (await client.get(f"{PORTAL}/milestone/{b_milestone.id}", headers=_auth(token))).status_code == 404
    for action in ("approve", "reject"):
        resp = await client.post(
            f"{PORTAL}/milestone/{b_milestone.id}/{action}",
            json={"comment": "no"},
            headers=_auth(token),
        )
        assert resp.status_code == 404, action


async def test_portal_token_cannot_be_used_as_user_auth_or_vice_versa(
    client, auth_headers, world, make_portal_token
):
    token, _ = await make_portal_token(
        client_id=world["client"].id, scope_type=ScopeType.PROJECT, scope=world["project"].id
    )
    assert (await client.get(f"{API}/invoices", headers=_auth(token))).status_code in (401, 403)
    resp = await client.get(f"{PORTAL}/project/{world['project'].id}", headers=auth_headers)
    assert resp.status_code == 401


async def test_portal_revoked_and_expired_tokens_rejected(client, world, make_portal_token):
    url = f"{PORTAL}/invoice/{world['invoice']['id']}"
    for kwargs in ({"revoked": True}, {"expires_in": timedelta(days=-1)}):
        token, _ = await make_portal_token(
            client_id=world["client"].id,
            scope_type=ScopeType.INVOICE,
            scope=uuid.UUID(world["invoice"]["id"]),
            **kwargs,
        )
        assert (await client.get(url, headers=_auth(token))).status_code == 401


# ---------------------------------------------------------------------------
# Controls: the same payloads succeed for the owner, so the refusals above are
# about ownership and not about a malformed body.
# ---------------------------------------------------------------------------


async def test_body_payloads_succeed_for_the_owner(client, auth_headers, world):
    start, end = _times()
    project_id = str(world["project"].id)
    created = {
        "time entry": await client.post(
            f"{API}/time-entries",
            json={
                "description": "x",
                "startTime": start,
                "endTime": end,
                "projectId": project_id,
                "milestoneId": str(world["milestone"].id),
            },
            headers=auth_headers,
        ),
        "milestone": await client.post(
            f"{API}/milestones", json={"name": "x", "projectId": project_id}, headers=auth_headers
        ),
        "change request": await client.post(
            f"{API}/change-requests", json={"projectId": project_id, "title": "x"}, headers=auth_headers
        ),
        "expense": await client.post(
            f"{API}/expenses",
            json={"description": "x", "amount": "5", "incurredOn": date.today().isoformat(), "projectId": project_id},
            headers=auth_headers,
        ),
        "invoice": await client.post(
            f"{API}/invoices",
            json={
                "projectId": project_id,
                "items": [{"description": "x", "quantity": "1", "unitPrice": "1"}],
                "paymentMethodIds": [world["method"]["id"]],
            },
            headers=auth_headers,
        ),
        "payment method order": await client.put(
            f"{API}/payment-methods/order", json={"ids": [world["method"]["id"]]}, headers=auth_headers
        ),
        "bulk": await client.patch(
            f"{API}/time-entries/bulk",
            json={"ids": [world["entry"]["id"]], "set": {"description": "ok"}},
            headers=auth_headers,
        ),
    }
    for name, resp in created.items():
        assert resp.status_code in (200, 201), f"{name}: {resp.status_code} {resp.text}"
