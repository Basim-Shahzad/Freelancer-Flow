"""Step 10: real email delivery (console + SMTP backends, templates, failures)."""

import logging
import socket
import uuid
from datetime import datetime, timedelta, timezone
from email import message_from_bytes
from email.policy import default as default_policy

import aiosmtplib
import pytest
from aiosmtpd.controller import Controller
from sqlalchemy import select

from app.core.config import Settings, settings
from app.models.InvoiceEvent import InvoiceEvent, InvoiceEventType
from app.services import email_service
from app.services.email_service import Attachment, EmailDeliveryError, _build_message

INVOICES_URL = "/api/v1/invoices"
MILESTONES_URL = "/api/v1/milestones"


# ── helpers ──────────────────────────────────────────────────────────────────


@pytest.fixture
def outbox(monkeypatch):
    """Capture every message instead of delivering it."""
    sent = []

    async def fake_deliver(msg):
        sent.append(msg)

    monkeypatch.setattr(email_service, "_deliver", fake_deliver)
    return sent


@pytest.fixture
def broken_mail(monkeypatch):
    async def failing_deliver(msg):
        raise EmailDeliveryError("SMTPConnectError: connection refused")

    monkeypatch.setattr(email_service, "_deliver", failing_deliver)


async def _invoice(client, headers, project_id, **overrides):
    resp = await client.post(
        INVOICES_URL,
        json={
            "projectId": str(project_id),
            "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
            **overrides,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _events(db_session, invoice_id):
    rows = await db_session.execute(
        select(InvoiceEvent)
        .where(InvoiceEvent.invoice_id == uuid.UUID(str(invoice_id)))
        .order_by(InvoiceEvent.occurred_at)
    )
    return list(rows.scalars())


def _attachments(msg):
    return [(p.get_filename(), p.get_content_type(), p.get_content()) for p in msg.iter_attachments()]


# ── sending the invoice ──────────────────────────────────────────────────────


async def test_send_emails_client_with_link_pdf_and_reply_to(
    client, auth_headers, project, user, outbox
):
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["emailDelivered"] is True

    assert len(outbox) == 1
    msg = outbox[0]
    assert "client@acme-example.com" in msg["To"]
    assert inv["invoiceNumber"] in msg["Subject"]
    assert user.email in msg["Reply-To"]
    text = msg.get_body(preferencelist=("plain",)).get_content()
    html = msg.get_body(preferencelist=("html",)).get_content()
    assert body["portalUrl"] in text and body["portalUrl"] in html
    assert "100.00 USD" in text
    assert "does not process payments" in text

    [(name, mime, data)] = _attachments(msg)
    assert name == f"{inv['invoiceNumber']}.pdf"
    assert mime == "application/pdf"
    assert data.startswith(b"%PDF")


async def test_resend_of_sent_invoice_sends_no_email_and_returns_links(
    client, auth_headers, project, outbox
):
    inv = await _invoice(client, auth_headers, project.id)
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    second = (await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)).json()
    assert len(outbox) == 1
    assert second["emailDelivered"] is None
    assert second["portalUrl"] and second["pdfUrl"] and second["whatsappUrl"]


async def test_send_failure_keeps_status_and_records_event(
    client, db_session, auth_headers, project, broken_mail
):
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["emailDelivered"] is False
    assert body["invoice"]["status"] == "SENT"
    assert body["portalUrl"]

    events = await _events(db_session, inv["id"])
    failed = [e for e in events if e.event_type == InvoiceEventType.EMAIL_FAILED]
    assert len(failed) == 1
    assert "connection refused" in failed[0].detail
    assert len(failed[0].detail) <= 255
    assert InvoiceEventType.SENT in [e.event_type for e in events]

    listed = await client.get(f"{INVOICES_URL}/{inv['id']}/events", headers=auth_headers)
    assert "EMAIL_FAILED" in [e["eventType"] for e in listed.json()["events"]]


async def test_retry_after_failure_delivers(client, auth_headers, project, monkeypatch):
    inv = await _invoice(client, auth_headers, project.id)
    calls = []

    async def flaky(msg):
        calls.append(msg)
        if len(calls) == 1:
            raise EmailDeliveryError("boom")

    monkeypatch.setattr(email_service, "_deliver", flaky)
    first = (await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)).json()
    second = (await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)).json()
    assert first["emailDelivered"] is False
    assert second["emailDelivered"] is True
    assert second["invoice"]["status"] == "SENT"


async def test_unexpected_error_while_building_email_also_does_not_500(
    client, auth_headers, project, monkeypatch
):
    def explode(**kwargs):
        raise RuntimeError("template bug")

    monkeypatch.setattr(email_service, "_build_message", explode)
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["emailDelivered"] is False
    assert resp.json()["invoice"]["status"] == "SENT"


async def test_pdf_failure_still_sends_link_only(client, auth_headers, project, outbox, monkeypatch):
    def broken_pdf(*args, **kwargs):
        raise RuntimeError("pdf engine down")

    monkeypatch.setattr("app.db.crud.invoices.render_invoice_pdf", broken_pdf)
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.json()["emailDelivered"] is True
    assert _attachments(outbox[0]) == []
    assert "attached as a PDF" not in outbox[0].get_body(preferencelist=("plain",)).get_content()


async def test_invalid_send_sends_nothing(client, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    await client.post(f"{INVOICES_URL}/{inv['id']}/cancel", headers=auth_headers)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 409
    assert outbox == []


# ── reminders ────────────────────────────────────────────────────────────────


async def test_reminder_email_has_no_pdf_and_is_rate_limited(client, auth_headers, project, outbox):
    inv = await _invoice(client, auth_headers, project.id)
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    outbox.clear()

    first = await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert first.status_code == 200, first.text
    assert len(outbox) == 1
    assert outbox[0]["Subject"].startswith("Reminder:")
    assert _attachments(outbox[0]) == []
    assert first.json()["portalUrl"] in outbox[0].get_body(preferencelist=("plain",)).get_content()

    second = await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert second.status_code == 429
    assert len(outbox) == 1


async def test_overdue_reminder_wording(client, auth_headers, project, outbox):
    past = datetime.now(timezone.utc) - timedelta(days=10)
    inv = await _invoice(
        client,
        auth_headers,
        project.id,
        issueDate=(past - timedelta(days=5)).isoformat(),
        dueDate=past.isoformat(),
    )
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    outbox.clear()
    await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert outbox[0]["Subject"].startswith("Overdue:")
    assert "overdue" in outbox[0].get_body(preferencelist=("plain",)).get_content().lower()


async def test_failed_reminder_is_recorded_and_can_be_retried(
    client, db_session, auth_headers, project, monkeypatch
):
    inv = await _invoice(client, auth_headers, project.id)
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)

    async def failing(msg):
        raise EmailDeliveryError("down")

    monkeypatch.setattr(email_service, "_deliver", failing)
    failed = await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert failed.status_code == 200
    assert failed.json()["emailDelivered"] is False
    events = await _events(db_session, inv["id"])
    assert any(
        e.event_type == InvoiceEventType.EMAIL_FAILED and e.detail.startswith("Reminder email")
        for e in events
    )

    # The client never got it, so the 24h limit must not block a retry.
    sent = []

    async def working(msg):
        sent.append(msg)

    monkeypatch.setattr(email_service, "_deliver", working)
    retry = await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert retry.status_code == 200
    assert retry.json()["emailDelivered"] is True
    assert len(sent) == 1
    # ...but once delivered, the limit applies again.
    again = await client.post(f"{INVOICES_URL}/{inv['id']}/remind", headers=auth_headers)
    assert again.status_code == 429


# ── milestone approval ───────────────────────────────────────────────────────


async def _milestone(client, headers, project_id):
    resp = await client.post(
        MILESTONES_URL,
        json={"name": "Wireframes", "projectId": str(project_id)},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_milestone_submit_emails_client_with_project_link(
    client, auth_headers, project, outbox
):
    m = await _milestone(client, auth_headers, project.id)
    resp = await client.post(f"{MILESTONES_URL}/{m['id']}/submit", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert len(outbox) == 1
    msg = outbox[0]
    assert "client@acme-example.com" in msg["To"]
    assert "Wireframes" in msg["Subject"]
    text = msg.get_body(preferencelist=("plain",)).get_content()
    assert f"/portal/projects/{project.id}?token=" in text
    assert project.name in text


async def test_milestone_email_failure_does_not_undo_submission(
    client, auth_headers, project, broken_mail
):
    m = await _milestone(client, auth_headers, project.id)
    resp = await client.post(f"{MILESTONES_URL}/{m['id']}/submit", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SUBMITTED"


# ── message building ─────────────────────────────────────────────────────────


def _msg(**overrides):
    kwargs = dict(
        to_email="c@example.com",
        to_name="Client",
        subject="Hello",
        template="invoice_sent",
        context={
            "client_name": "Client",
            "issuer_name": "Me",
            "invoice_number": "INV-1",
            "total": "1.00 USD",
            "due_date": "01 Jan 2030",
            "portal_url": "http://x/y?token=abc",
        },
    )
    kwargs.update(overrides)
    return _build_message(**kwargs)


def test_user_supplied_names_cannot_inject_headers():
    msg = _msg(to_name="Evil\r\nBcc: victim@example.com", from_name="Me\nCc: a@b.com")
    parsed = message_from_bytes(msg.as_bytes(), policy=default_policy)
    assert parsed["Bcc"] is None and parsed["Cc"] is None
    assert parsed["To"].addresses[0].addr_spec == "c@example.com"


def test_html_part_escapes_user_content():
    ctx = {
        "client_name": "<script>alert(1)</script>",
        "issuer_name": "Me & Co",
        "invoice_number": "INV-1",
        "total": "1.00 USD",
        "due_date": "01 Jan 2030",
        "portal_url": "http://x/y",
    }
    html = _msg(context=ctx).get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html
    assert "&lt;script&gt;" in html and "Me &amp; Co" in html


def test_message_has_plain_and_html_alternatives():
    msg = _msg(attachments=[Attachment("a.pdf", b"%PDF-1.4 x")])
    assert msg.get_body(preferencelist=("plain",)) is not None
    assert msg.get_body(preferencelist=("html",)) is not None
    assert len(list(msg.iter_attachments())) == 1


# ── console backend ──────────────────────────────────────────────────────────


async def test_console_backend_logs_and_redacts_tokens_in_production(monkeypatch, caplog):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    msg = _msg()

    with caplog.at_level(logging.INFO, logger=email_service.logger.name):
        await email_service._deliver(msg)
    assert "token=abc" in caplog.text  # dev: handy to click through

    caplog.clear()
    monkeypatch.setattr(settings, "APP_ENV", "production")
    with caplog.at_level(logging.INFO, logger=email_service.logger.name):
        await email_service._deliver(msg)
    assert "abc" not in caplog.text
    assert "token=***" in caplog.text


# ── SMTP backend ─────────────────────────────────────────────────────────────


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _Collector:
    def __init__(self):
        self.envelopes = []

    async def handle_DATA(self, server, session, envelope):
        self.envelopes.append(envelope)
        return "250 OK"


@pytest.fixture
def smtp_server(monkeypatch):
    """A real local SMTP server (the Mailpit stand-in) the app talks to."""
    handler = _Collector()
    port = _free_port()
    controller = Controller(handler, hostname="127.0.0.1", port=port)
    controller.start()
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
    monkeypatch.setattr(settings, "SMTP_PORT", port)
    monkeypatch.setattr(settings, "SMTP_USE_TLS", False)
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "SMTP_FROM", "Paylancr <invoices@paylancr.test>")
    try:
        yield handler
    finally:
        controller.stop()


async def test_smtp_delivers_invoice_email_with_pdf_attached(
    client, auth_headers, project, smtp_server
):
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["emailDelivered"] is True

    [envelope] = smtp_server.envelopes
    assert envelope.mail_from == "invoices@paylancr.test"
    assert envelope.rcpt_tos == ["client@acme-example.com"]
    parsed = message_from_bytes(envelope.content, policy=default_policy)
    assert inv["invoiceNumber"] in parsed["Subject"]
    [pdf] = list(parsed.iter_attachments())
    assert pdf.get_filename() == f"{inv['invoiceNumber']}.pdf"
    assert pdf.get_content().startswith(b"%PDF")


async def test_smtp_unreachable_server_is_a_recorded_failure(
    client, db_session, auth_headers, project, monkeypatch
):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "127.0.0.1")
    monkeypatch.setattr(settings, "SMTP_PORT", _free_port())  # nothing listening
    monkeypatch.setattr(settings, "SMTP_USE_TLS", False)
    monkeypatch.setattr(settings, "SMTP_FROM", "invoices@paylancr.test")
    inv = await _invoice(client, auth_headers, project.id)
    resp = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["emailDelivered"] is False
    assert resp.json()["invoice"]["status"] == "SENT"
    events = await _events(db_session, inv["id"])
    assert any(e.event_type == InvoiceEventType.EMAIL_FAILED for e in events)


@pytest.mark.parametrize(
    "port,use_tls,implicit,starttls",
    [(587, True, False, True), (465, True, True, False), (1025, False, False, False)],
)
async def test_smtp_tls_mode_follows_port_and_setting(
    monkeypatch, port, use_tls, implicit, starttls
):
    captured = {}

    async def fake_send(msg, **kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(aiosmtplib, "send", fake_send)
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", port)
    monkeypatch.setattr(settings, "SMTP_USE_TLS", use_tls)
    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")
    await email_service._deliver(_msg())
    assert captured["use_tls"] is implicit
    assert captured["start_tls"] is starttls
    assert captured["hostname"] == "smtp.example.com"
    assert captured["username"] == "user" and captured["password"] == "pw"


async def test_smtp_rejection_is_wrapped_as_delivery_error(monkeypatch):
    async def reject(msg, **kwargs):
        raise aiosmtplib.SMTPRecipientsRefused([])

    monkeypatch.setattr(aiosmtplib, "send", reject)
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    with pytest.raises(EmailDeliveryError):
        await email_service._deliver(_msg())


# ── configuration ────────────────────────────────────────────────────────────


def test_smtp_backend_requires_host_and_from():
    base = settings.model_dump()
    base.update(EMAIL_BACKEND="smtp", SMTP_HOST="", SMTP_FROM="")
    with pytest.raises(ValueError, match="SMTP_HOST and SMTP_FROM"):
        Settings(_env_file=None, **base)
    base.update(SMTP_HOST="localhost", SMTP_FROM="a@b.com")
    assert Settings(_env_file=None, **base).EMAIL_BACKEND == "smtp"


def test_default_backend_is_console():
    assert Settings.model_fields["EMAIL_BACKEND"].default == "console"
