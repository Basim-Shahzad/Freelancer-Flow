"""Step 11: WhatsApp sharing, share links, channels and viewed tracking."""

import uuid
from datetime import date
from decimal import Decimal
from urllib.parse import parse_qs, urlparse

import pytest
from sqlalchemy import select

from app.models.ActivityEvent import ActivityEvent
from app.models.InvoiceEvent import InvoiceEvent, InvoiceEventType
from app.services import email_service
from app.services.sharing import build_whatsapp_url, invoice_message

INVOICES_URL = "/api/v1/invoices"
CLIENTS_URL = "/api/v1/clients"
RATES = {"base": "USD", "rates": {"PKR": 280, "USD": 1}, "as_of": "2026-10-01", "source": "test"}


# -- pure builders ------------------------------------------------------------


def _msg(**kw):
    base = dict(
        client_name="Ali & Co",
        invoice_number="INV-0001",
        amount=Decimal("100"),
        currency="USD",
        due_date=date(2026, 11, 1),
        portal_link="https://app.test/portal/invoices/1?token=abc",
        issuer_name="Sam",
        rates=RATES,
    )
    base.update(kw)
    return invoice_message(**base)


def test_whatsapp_url_encodes_text():
    text = "Hello Ali & Co,\nPay 100% — ünï?x=1"
    url = build_whatsapp_url("+923001234567", text)
    assert url.startswith("https://wa.me/923001234567?text=")
    query = urlparse(url).query
    assert "\n" not in query and " " not in query and "&" not in query
    assert parse_qs(query)["text"] == [text]


def test_whatsapp_url_without_number():
    assert build_whatsapp_url(None, "hi there") == "https://wa.me/?text=hi%20there"


def test_message_has_reference_amount_and_due_date():
    text = _msg()
    assert "INV-0001" in text and "USD 100.00" in text
    assert "PKR 28,000.00" in text and "Reference rate only" in text
    assert "Due date: 2026-11-01" in text and "token=abc" in text


def test_message_omits_reference_without_rate_or_pair():
    assert "PKR" not in _msg(rates={"base": "USD", "rates": {}})
    assert "about" not in _msg(currency="EUR")


def test_reminder_wording():
    assert "overdue" in _msg(reminder=True, overdue=True)
    assert "friendly reminder" in _msg(reminder=True)
    assert "Balance due" in _msg(reminder=True)


# -- API ----------------------------------------------------------------------


@pytest.fixture
def outbox(monkeypatch):
    sent = []

    async def fake_deliver(msg):
        sent.append(msg)

    monkeypatch.setattr(email_service, "_deliver", fake_deliver)
    return sent


async def _invoice(client, headers, project_id):
    resp = await client.post(
        INVOICES_URL,
        json={
            "projectId": str(project_id),
            "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _send(client, headers, invoice_id, channel=None, path="send"):
    body = {"channel": channel} if channel else None
    return await client.post(f"{INVOICES_URL}/{invoice_id}/{path}", json=body, headers=headers)


async def _events(db_session, invoice_id):
    rows = await db_session.execute(
        select(InvoiceEvent).where(InvoiceEvent.invoice_id == uuid.UUID(str(invoice_id)))
    )
    return list(rows.scalars().all())


@pytest.mark.parametrize("channel", ["whatsapp", "link"])
async def test_non_email_channels_issue_without_mail(
    client, db_session, auth_headers, project, outbox, channel
):
    inv = await _invoice(client, auth_headers, project.id)
    resp = await _send(client, auth_headers, inv["id"], channel)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["invoice"]["status"] == "SENT"
    assert body["emailDelivered"] is None
    assert outbox == []
    assert body["whatsappUrl"].startswith("https://wa.me/?text=")
    token = body["portalUrl"].split("token=")[1]
    assert body["pdfUrl"].endswith(f"/portal/invoice/{inv['id']}/pdf?token={token}")
    events = await _events(db_session, inv["id"])
    assert [e.detail for e in events if e.event_type == InvoiceEventType.SENT] == [
        f"Sent via {channel}"
    ]
    acts = (await db_session.execute(select(ActivityEvent))).scalars().all()
    assert any(a.action == "sent" and str(a.entity_id) == inv["id"] for a in acts)


async def test_email_channel_sends_mail(client, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    body = (await _send(client, auth_headers, inv["id"], "email")).json()
    assert len(outbox) == 1 and body["emailDelivered"] is True


async def test_default_channel_is_email(client, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    resp = await _send(client, auth_headers, inv["id"])
    assert resp.status_code == 200 and len(outbox) == 1


async def test_resend_changes_nothing(client, db_session, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    first = (await _send(client, auth_headers, inv["id"], "link")).json()
    before = len(await _events(db_session, inv["id"]))
    second = (await _send(client, auth_headers, inv["id"], "email")).json()
    assert outbox == []
    assert len(await _events(db_session, inv["id"])) == before
    assert second["invoice"]["status"] == "SENT"
    assert second["invoice"]["sentAt"] == first["invoice"]["sentAt"]
    assert second["emailDelivered"] is None


async def test_whatsapp_url_uses_client_number(
    client, auth_headers, project, client_profile, db_session
):
    client_profile.whatsapp_number = "+923001234567"
    await db_session.commit()
    inv = await _invoice(client, auth_headers, project.id)
    body = (await _send(client, auth_headers, inv["id"], "whatsapp")).json()
    assert body["whatsappUrl"].startswith("https://wa.me/923001234567?text=")
    text = parse_qs(urlparse(body["whatsappUrl"]).query)["text"][0]
    assert inv["invoiceNumber"] in text and body["portalUrl"] in text


async def test_share_requires_issued_invoice(client, db_session, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    url = f"{INVOICES_URL}/{inv['id']}/share"
    assert (await client.get(url, headers=auth_headers)).status_code == 409
    await _send(client, auth_headers, inv["id"], "link")
    before = len(await _events(db_session, inv["id"]))
    resp = await client.get(url, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert set(resp.json()) == {"portalUrl", "pdfUrl", "whatsappUrl"}
    assert len(await _events(db_session, inv["id"])) == before
    await client.post(f"{INVOICES_URL}/{inv['id']}/cancel", headers=auth_headers)
    assert (await client.get(url, headers=auth_headers)).status_code == 409


async def test_share_is_owner_only(client, auth_headers, other_auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    await _send(client, auth_headers, inv["id"], "link")
    url = f"{INVOICES_URL}/{inv['id']}/share"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=other_auth_headers)).status_code in (403, 404)


async def test_remind_via_whatsapp(client, db_session, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    await _send(client, auth_headers, inv["id"], "link")
    resp = await _send(client, auth_headers, inv["id"], "whatsapp", path="remind")
    assert resp.status_code == 200, resp.text
    assert outbox == []
    text = parse_qs(urlparse(resp.json()["whatsappUrl"]).query)["text"][0]
    assert "reminder" in text.lower()
    events = await _events(db_session, inv["id"])
    assert [e.event_type for e in events].count(InvoiceEventType.REMINDED) == 1
    again = await _send(client, auth_headers, inv["id"], "whatsapp", path="remind")
    assert again.status_code == 429


async def test_first_portal_open_logs_one_viewed(client, db_session, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    body = (await _send(client, auth_headers, inv["id"], "link")).json()
    token = body["portalUrl"].split("token=")[1]
    headers = {"Authorization": f"Bearer {token}"}

    def viewed(evs):
        return [e for e in evs if e.event_type == InvoiceEventType.VIEWED]

    pdf = await client.get(f"/api/v1/portal/invoice/{inv['id']}/pdf", headers=headers)
    assert pdf.status_code == 200
    assert viewed(await _events(db_session, inv["id"])) == []
    for _ in range(2):
        r = await client.get(f"/api/v1/portal/invoice/{inv['id']}", headers=headers)
        assert r.status_code == 200
    assert len(viewed(await _events(db_session, inv["id"]))) == 1


# -- clients ------------------------------------------------------------------


async def test_client_whatsapp_number_is_normalized(client, auth_headers, freelancer_profile):
    resp = await client.post(
        CLIENTS_URL,
        json={"name": "Ali", "email": "ali@example.com", "whatsappNumber": "0300-1234567"},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    assert resp.json()["whatsappNumber"] == "+923001234567"
    cid = resp.json()["id"]
    upd = await client.patch(
        f"{CLIENTS_URL}/{cid}", json={"whatsappNumber": "+14155550123"}, headers=auth_headers
    )
    assert upd.status_code == 200, upd.text
    assert upd.json()["whatsappNumber"] == "+14155550123"
    bad = await client.patch(
        f"{CLIENTS_URL}/{cid}", json={"whatsappNumber": "nope"}, headers=auth_headers
    )
    assert bad.status_code == 422
