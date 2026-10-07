"""Step 5: payment-instructions block snapshotted onto invoices."""

import json

from sqlalchemy import select, text

from app.models.ActivityEvent import ActivityEvent
from app.models.InvoicePaymentMethod import InvoicePaymentMethod
from tests.test_payment_methods import PK_IBAN, VALID, body

METHODS_URL = "/api/v1/payment-methods"
INVOICES_URL = "/api/v1/invoices"
PORTAL_URL = "/api/v1/portal"
DISCLAIMER = (
    "Paylancr does not process payments. "
    "Pay the freelancer directly using the details below."
)
MISSING_ID = "00000000-0000-0000-0000-000000000000"


async def _method(client, headers, type_="ESFCA_WIRE", **extra):
    resp = await client.post(
        METHODS_URL, json=body(type_, VALID[type_], **extra), headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _invoice(client, headers, project_id, **overrides):
    payload = {
        "projectId": str(project_id),
        "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
        **overrides,
    }
    return await client.post(INVOICES_URL, json=payload, headers=headers)


async def _invoice_ok(client, headers, project_id, **overrides):
    resp = await _invoice(client, headers, project_id, **overrides)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _send_token(client, headers, invoice_id):
    sent = (await client.post(f"{INVOICES_URL}/{invoice_id}/send", headers=headers)).json()
    return sent["portalUrl"].split("token=", 1)[1]


# ── Creation ──────────────────────────────────────────────────────────────────


async def test_no_methods_configured_gives_empty_block(client, auth_headers, project):
    inv = await _invoice_ok(client, auth_headers, project.id)
    assert inv["paymentMethods"] == []
    assert inv["paymentDisclaimer"] == DISCLAIMER


async def test_omitted_ids_snapshot_active_defaults_in_order(client, auth_headers, project):
    first = await _method(client, auth_headers, "ESFCA_WIRE")  # auto default
    await _method(client, auth_headers, "RAAST")  # not default
    third = await _method(client, auth_headers, "JAZZCASH", isDefault=True)
    retired = await _method(client, auth_headers, "EASYPAISA", isDefault=True)
    await client.patch(
        f"{METHODS_URL}/{retired['id']}", json={"isActive": False}, headers=auth_headers
    )

    inv = await _invoice_ok(client, auth_headers, project.id)
    assert [m["type"] for m in inv["paymentMethods"]] == ["ESFCA_WIRE", "JAZZCASH"]
    assert inv["paymentMethods"][0]["label"] == first["label"]
    assert inv["paymentMethods"][1]["label"] == third["label"]
    assert inv["paymentMethods"][0]["details"]["iban"] == PK_IBAN


async def test_explicit_ids_use_given_order_and_empty_list_means_none(
    client, auth_headers, project
):
    a = await _method(client, auth_headers, "ESFCA_WIRE")
    b = await _method(client, auth_headers, "RAAST")

    inv = await _invoice_ok(
        client, auth_headers, project.id, paymentMethodIds=[b["id"], a["id"]]
    )
    assert [m["type"] for m in inv["paymentMethods"]] == ["RAAST", "ESFCA_WIRE"]

    none = await _invoice_ok(client, auth_headers, project.id, paymentMethodIds=[])
    assert none["paymentMethods"] == []


async def test_unknown_inactive_foreign_and_duplicate_ids_rejected(
    client, auth_headers, other_auth_headers, project
):
    mine = await _method(client, auth_headers, "ESFCA_WIRE")
    theirs = await _method(client, other_auth_headers, "RAAST")
    retired = await _method(client, auth_headers, "JAZZCASH")
    await client.patch(
        f"{METHODS_URL}/{retired['id']}", json={"isActive": False}, headers=auth_headers
    )

    for ids in (
        [MISSING_ID],
        [theirs["id"]],  # another freelancer's method must never leak
        [retired["id"]],
        [mine["id"], mine["id"]],
    ):
        resp = await _invoice(client, auth_headers, project.id, paymentMethodIds=ids)
        assert resp.status_code == 422, (ids, resp.text)


async def test_payoneer_exposes_pay_link_only_for_payoneer(client, auth_headers, project):
    await _method(client, auth_headers, "PAYONEER", isDefault=True)
    await _method(client, auth_headers, "ESFCA_WIRE", isDefault=True)
    inv = await _invoice_ok(client, auth_headers, project.id)
    links = {m["type"]: m["payLink"] for m in inv["paymentMethods"]}
    assert links["PAYONEER"] == "https://payoneer.com/pay/me"
    assert links["ESFCA_WIRE"] is None


async def test_payoneer_without_url_has_no_pay_link(client, auth_headers, project):
    resp = await client.post(
        METHODS_URL,
        json=body("PAYONEER", {"accountEmail": "me@example.com"}),
        headers=auth_headers,
    )
    assert resp.status_code == 201
    inv = await _invoice_ok(client, auth_headers, project.id)
    assert inv["paymentMethods"][0]["payLink"] is None


async def test_free_text_payment_instructions_still_work_alongside(
    client, auth_headers, project
):
    await _method(client, auth_headers)
    inv = await _invoice_ok(
        client, auth_headers, project.id, paymentInstructions="Quote the invoice no."
    )
    assert inv["paymentInstructions"] == "Quote the invoice no."
    assert len(inv["paymentMethods"]) == 1


# ── Snapshot semantics ────────────────────────────────────────────────────────


async def test_config_edits_do_not_change_issued_invoice(client, auth_headers, project):
    method = await _method(client, auth_headers, "ESFCA_WIRE")
    inv = await _invoice_ok(client, auth_headers, project.id)
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)

    changed = {**VALID["ESFCA_WIRE"], "bankName": "Another Bank"}
    patch = await client.patch(
        f"{METHODS_URL}/{method['id']}",
        json={"label": "Renamed", "details": changed},
        headers=auth_headers,
    )
    assert patch.status_code == 200

    got = (await client.get(f"{INVOICES_URL}/{inv['id']}", headers=auth_headers)).json()
    snap = got["paymentMethods"][0]
    assert snap["label"] == method["label"]
    assert snap["details"]["bankName"] == VALID["ESFCA_WIRE"]["bankName"]

    # New invoices pick up the edit.
    new = await _invoice_ok(client, auth_headers, project.id)
    assert new["paymentMethods"][0]["details"]["bankName"] == "Another Bank"


async def test_deleting_config_keeps_snapshot(client, auth_headers, project, db_session):
    method = await _method(client, auth_headers)
    inv = await _invoice_ok(client, auth_headers, project.id)
    assert (
        await client.delete(f"{METHODS_URL}/{method['id']}", headers=auth_headers)
    ).status_code == 204

    got = (await client.get(f"{INVOICES_URL}/{inv['id']}", headers=auth_headers)).json()
    assert len(got["paymentMethods"]) == 1
    row = (await db_session.execute(select(InvoicePaymentMethod))).scalar_one()
    assert row.source_method_id is None


async def test_snapshot_encrypted_at_rest(client, auth_headers, project, db_session):
    await _method(client, auth_headers)
    await _invoice_ok(client, auth_headers, project.id)
    raw = (
        await db_session.execute(text("SELECT details FROM invoice_payment_methods"))
    ).scalar_one()
    assert PK_IBAN not in raw
    # ...but round-trips through the ORM.
    row = (await db_session.execute(select(InvoicePaymentMethod))).scalar_one()
    assert json.loads(row.details)["iban"] == PK_IBAN


# ── Updating ──────────────────────────────────────────────────────────────────


async def test_draft_methods_can_be_replaced_and_cleared(client, auth_headers, project):
    a = await _method(client, auth_headers, "ESFCA_WIRE")
    b = await _method(client, auth_headers, "RAAST")
    inv = await _invoice_ok(client, auth_headers, project.id, paymentMethodIds=[a["id"]])

    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}",
        json={"paymentMethodIds": [b["id"], a["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert [m["type"] for m in resp.json()["paymentMethods"]] == ["RAAST", "ESFCA_WIRE"]

    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}", json={"paymentMethodIds": []}, headers=auth_headers
    )
    assert resp.json()["paymentMethods"] == []


async def test_patch_without_ids_leaves_methods_alone(client, auth_headers, project):
    await _method(client, auth_headers)
    inv = await _invoice_ok(client, auth_headers, project.id)
    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}", json={"notes": "Thanks"}, headers=auth_headers
    )
    assert len(resp.json()["paymentMethods"]) == 1


async def test_null_ids_rejected_on_patch(client, auth_headers, project):
    inv = await _invoice_ok(client, auth_headers, project.id)
    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}", json={"paymentMethodIds": None}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_sent_invoice_methods_cannot_change(client, auth_headers, project):
    a = await _method(client, auth_headers, "ESFCA_WIRE")
    b = await _method(client, auth_headers, "RAAST")
    inv = await _invoice_ok(client, auth_headers, project.id, paymentMethodIds=[a["id"]])
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)

    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}",
        json={"paymentMethodIds": [b["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    got = (await client.get(f"{INVOICES_URL}/{inv['id']}", headers=auth_headers)).json()
    assert [m["type"] for m in got["paymentMethods"]] == ["ESFCA_WIRE"]


async def test_update_with_invalid_ids_changes_nothing(client, auth_headers, project):
    a = await _method(client, auth_headers, "ESFCA_WIRE")
    inv = await _invoice_ok(client, auth_headers, project.id, paymentMethodIds=[a["id"]])
    resp = await client.patch(
        f"{INVOICES_URL}/{inv['id']}",
        json={"notes": "x", "paymentMethodIds": [MISSING_ID]},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    got = (await client.get(f"{INVOICES_URL}/{inv['id']}", headers=auth_headers)).json()
    assert len(got["paymentMethods"]) == 1
    assert got["notes"] is None


async def test_update_logs_labels_never_details(client, auth_headers, project, db_session):
    a = await _method(client, auth_headers, "ESFCA_WIRE")
    inv = await _invoice_ok(client, auth_headers, project.id, paymentMethodIds=[a["id"]])
    await client.patch(
        f"{INVOICES_URL}/{inv['id']}", json={"paymentMethodIds": []}, headers=auth_headers
    )
    events = (
        await db_session.execute(
            select(ActivityEvent).where(
                ActivityEvent.entity_type == "invoice", ActivityEvent.action == "updated"
            )
        )
    ).scalars().all()
    assert len(events) == 1
    assert events[0].changes["payment_methods"] == {"old": [a["label"]], "new": []}
    assert PK_IBAN not in json.dumps(events[0].changes)


# ── Ownership / lists / portal ────────────────────────────────────────────────


async def test_other_user_cannot_see_invoice_methods(
    client, auth_headers, other_auth_headers, project
):
    await _method(client, auth_headers)
    inv = await _invoice_ok(client, auth_headers, project.id)
    resp = await client.get(f"{INVOICES_URL}/{inv['id']}", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_list_includes_methods(client, auth_headers, project):
    await _method(client, auth_headers)
    await _invoice_ok(client, auth_headers, project.id)
    resp = await client.get(INVOICES_URL, headers=auth_headers)
    assert len(resp.json()["invoices"][0]["paymentMethods"]) == 1


async def test_portal_shows_block_pay_link_and_disclaimer(client, auth_headers, project):
    await _method(client, auth_headers, "PAYONEER", isDefault=True)
    await _method(client, auth_headers, "JAZZCASH", isDefault=True)
    inv = await _invoice_ok(client, auth_headers, project.id)
    token = await _send_token(client, auth_headers, inv["id"])

    resp = await client.get(
        f"{PORTAL_URL}/invoice/{inv['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["paymentDisclaimer"] == DISCLAIMER
    by_type = {m["type"]: m for m in data["paymentMethods"]}
    assert by_type["PAYONEER"]["payLink"] == "https://payoneer.com/pay/me"
    assert by_type["JAZZCASH"]["details"]["mobileNumber"] == "+923001234567"


async def test_portal_invoice_is_snapshot_not_live_config(client, auth_headers, project):
    method = await _method(client, auth_headers, "ESFCA_WIRE")
    inv = await _invoice_ok(client, auth_headers, project.id)
    token = await _send_token(client, auth_headers, inv["id"])
    await client.delete(f"{METHODS_URL}/{method['id']}", headers=auth_headers)

    resp = await client.get(
        f"{PORTAL_URL}/invoice/{inv['id']}", headers={"Authorization": f"Bearer {token}"}
    )
    assert len(resp.json()["paymentMethods"]) == 1
