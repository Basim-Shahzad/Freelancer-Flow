"""Outgoing email.

The public ``send_*`` functions build a message from the templates in
``app/templates/email`` and hand it to the backend picked by
``settings.EMAIL_BACKEND``:

- ``console``: logs the message (links are redacted in production, they carry
  bearer tokens). Used by dev and tests.
- ``smtp``: delivers through ``aiosmtplib`` to ``SMTP_HOST`` (a provider's SMTP
  endpoint, or Mailpit locally).

Delivery failures raise ``EmailDeliveryError``; callers decide what a failed
email means (invoices record an ``EMAIL_FAILED`` event and carry on).
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from pathlib import Path
from typing import Optional

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.config import settings

logger = logging.getLogger(__name__)

_TEMPLATES = Path(__file__).resolve().parent.parent / "templates"
_html_env = Environment(loader=FileSystemLoader(_TEMPLATES), autoescape=select_autoescape(["html"]))
_text_env = Environment(loader=FileSystemLoader(_TEMPLATES), autoescape=False, keep_trailing_newline=True)


class EmailDeliveryError(RuntimeError):
    """The message could not be handed to / accepted by the mail server."""


@dataclass(frozen=True)
class Attachment:
    filename: str
    content: bytes
    mime_type: str = "application/pdf"


# ── Message building ─────────────────────────────────────────────────────────


def _clean(value: str) -> str:
    """Header-safe: no CR/LF (header injection) from user-supplied names."""
    return re.sub(r"[\r\n]+", " ", value).strip()


def _build_message(
    *,
    to_email: str,
    to_name: str,
    subject: str,
    template: str,
    context: dict,
    from_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    attachments: Optional[list[Attachment]] = None,
) -> EmailMessage:
    sender_address = parseaddr(settings.SMTP_FROM)[1] or settings.SMTP_FROM or "noreply@paylancr.local"
    msg = EmailMessage()
    msg["Subject"] = _clean(subject)
    msg["From"] = formataddr((_clean(from_name or "Paylancr"), sender_address))
    msg["To"] = formataddr((_clean(to_name), _clean(to_email)))
    if reply_to:
        msg["Reply-To"] = _clean(reply_to)

    context = {**context, "has_attachment": bool(attachments)}
    msg.set_content(_text_env.get_template(f"email/{template}.txt").render(**context))
    msg.add_alternative(_html_env.get_template(f"email/{template}.html").render(**context), subtype="html")
    for att in attachments or []:
        maintype, _, subtype = att.mime_type.partition("/")
        msg.add_attachment(att.content, maintype=maintype, subtype=subtype, filename=att.filename)
    return msg


# ── Backends ─────────────────────────────────────────────────────────────────


def _redact(text: str) -> str:
    return re.sub(r"(token=)[^\s&\"'<]+", r"\1***", text)


async def _send_console(msg: EmailMessage) -> None:
    body = msg.get_body(preferencelist=("plain",))
    text = body.get_content() if body else ""
    if settings.is_production:
        text = _redact(text)
    attachments = [p.get_filename() for p in msg.iter_attachments()]
    logger.info(
        "[EMAIL:console] To: %s | Subject: %s | Attachments: %s\n%s",
        msg["To"],
        msg["Subject"],
        attachments or "none",
        text,
    )


async def _send_smtp(msg: EmailMessage) -> None:
    port = settings.SMTP_PORT
    implicit_tls = settings.SMTP_USE_TLS and port == 465
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=port,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=implicit_tls,
            start_tls=settings.SMTP_USE_TLS and not implicit_tls,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
    except (aiosmtplib.SMTPException, OSError, TimeoutError) as exc:
        raise EmailDeliveryError(f"{type(exc).__name__}: {exc}") from exc


async def _deliver(msg: EmailMessage) -> None:
    if settings.EMAIL_BACKEND == "smtp":
        await _send_smtp(msg)
    else:
        await _send_console(msg)


# ── Public API ───────────────────────────────────────────────────────────────


def _money(amount: str | Decimal, currency: str) -> str:
    # Local import: services.pdf pulls in the PDF stack.
    from app.services.pdf import format_money

    return format_money(Decimal(str(amount)), currency)


async def send_portal_approval_email(
    to_client_id: uuid.UUID,
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    portal_token: str,
    *,
    to_email: Optional[str] = None,
    client_name: str = "there",
    issuer_name: str = "Your freelancer",
    project_name: str = "your project",
    milestone_name: str = "a milestone",
    portal_url: Optional[str] = None,
    reply_to: Optional[str] = None,
) -> None:
    """Ask the client to review a submitted milestone."""
    if not to_email:
        logger.warning("Milestone %s approval email skipped: no recipient address", milestone_id)
        return
    link = portal_url or f"{settings.FRONTEND_URL.rstrip('/')}/portal/projects/{project_id}?token={portal_token}"
    msg = _build_message(
        to_email=to_email,
        to_name=client_name,
        subject=f"{issuer_name} needs your approval: {milestone_name}",
        template="milestone_approval",
        context={
            "client_name": client_name,
            "issuer_name": issuer_name,
            "project_name": project_name,
            "milestone_name": milestone_name,
            "portal_url": link,
        },
        from_name=issuer_name,
        reply_to=reply_to,
    )
    await _deliver(msg)


async def send_invoice_email(
    to_email: str,
    client_name: str,
    invoice_number: str,
    total: str,
    currency: str,
    due_date: datetime,
    portal_url: str,
    *,
    issuer_name: str = "Your freelancer",
    reply_to: Optional[str] = None,
    attachments: Optional[list[Attachment]] = None,
) -> None:
    """Email the client a link to their invoice (PDF attached when given)."""
    msg = _build_message(
        to_email=to_email,
        to_name=client_name,
        subject=f"Invoice {invoice_number} from {issuer_name}",
        template="invoice_sent",
        context={
            "client_name": client_name,
            "issuer_name": issuer_name,
            "invoice_number": invoice_number,
            "total": _money(total, currency),
            "due_date": f"{due_date:%d %b %Y}",
            "portal_url": portal_url,
        },
        from_name=issuer_name,
        reply_to=reply_to,
        attachments=attachments,
    )
    await _deliver(msg)


async def send_invoice_reminder_email(
    to_email: str,
    client_name: str,
    invoice_number: str,
    balance_due: str,
    currency: str,
    due_date: datetime,
    overdue: bool,
    portal_url: str,
    *,
    issuer_name: str = "Your freelancer",
    reply_to: Optional[str] = None,
) -> None:
    """Remind the client about an unpaid invoice."""
    prefix = "Overdue" if overdue else "Reminder"
    msg = _build_message(
        to_email=to_email,
        to_name=client_name,
        subject=f"{prefix}: invoice {invoice_number} from {issuer_name}",
        template="invoice_reminder",
        context={
            "client_name": client_name,
            "issuer_name": issuer_name,
            "invoice_number": invoice_number,
            "balance_due": _money(balance_due, currency),
            "due_date": f"{due_date:%d %b %Y}",
            "overdue": overdue,
            "portal_url": portal_url,
        },
        from_name=issuer_name,
        reply_to=reply_to,
    )
    await _deliver(msg)
