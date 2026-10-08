"""Invoice PDF rendering (Jinja2 -> xhtml2pdf). Presentation only, no I/O.

Money Rule: the PKR/USD line is a display-only estimate (``services.fx``) and
the payment block is the freelancer's own details; Paylancr never charges.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from typing import Any, Mapping, Optional

from fastapi import Response
from jinja2 import Environment, FileSystemLoader, select_autoescape
from xhtml2pdf import pisa

from app.core.currencies import currency_exponent
from app.models.Invoice import Invoice, InvoiceStatus
from app.schemas.InvoiceSchema import PAYMENT_DISCLAIMER
from app.services.fx import REFERENCE_NOTE, convert_for_display, display_currency_for

_TEMPLATES = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(_TEMPLATES),
    autoescape=select_autoescape(["html"]),
)

_STATUS_LABELS = {
    InvoiceStatus.DRAFT: "DRAFT",
    InvoiceStatus.PAID: "PAID",
    InvoiceStatus.WRITTEN_OFF: "WRITTEN OFF",
    InvoiceStatus.CANCELLED: "CANCELLED",
}


class PdfRenderError(RuntimeError):
    pass


def format_money(value: Decimal, currency: Optional[str]) -> str:
    """``1,234.50 USD``, with the currency's own number of decimals."""
    exp = currency_exponent(currency)
    return f"{value:,.{exp}f} {currency or ''}".strip()


def format_date(value) -> str:
    return value.strftime("%d %b %Y") if value else ""


def _label(key: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", " ", key).replace("_", " ").strip().capitalize()


def _payment_rows(raw: str | Mapping[str, Any]) -> list[tuple[str, str]]:
    details = json.loads(raw) if isinstance(raw, str) else dict(raw)
    return [
        (_label(k), str(v))
        for k, v in details.items()
        if v not in (None, "", [], {})
    ]


def _reference_line(invoice: Invoice, rates: Optional[Mapping[str, Any]]) -> Optional[dict]:
    """Total and balance in the counterpart currency (USD<->PKR), or ``None``."""
    other = display_currency_for(invoice.currency)
    if not other or not rates:
        return None
    total = convert_for_display(invoice.total, invoice.currency, other, rates)
    if total is None:
        return None
    balance = convert_for_display(invoice.balance_due, invoice.currency, other, rates)
    parts = [f"Total approx. {format_money(total.amount, other)}"]
    if balance is not None and invoice.balance_due != invoice.total:
        parts.append(f"Balance due approx. {format_money(balance.amount, other)}")
    if total.as_of:
        parts.append(f"rate as of {format_date(total.as_of)}")
    return {"text": "; ".join(parts), "note": REFERENCE_NOTE}


def render_invoice_pdf(
    invoice: Invoice, rates: Optional[Mapping[str, Any]] = None
) -> bytes:
    """Render ``invoice`` to PDF bytes.

    Needs ``client``, ``freelancer`` (+ ``user``), items, taxes, payments and
    payment methods loaded (``invoices._load_options``). ``rates`` is the
    ``get_exchange_rates`` dict; without it the reference line is omitted.
    """
    cur = invoice.currency
    taxes = sorted(invoice.taxes, key=lambda t: t.sort_order)
    html = _env.get_template("invoice.html").render(
        invoice=invoice,
        issuer=invoice.issuer,
        client=invoice.client,
        project=invoice.project,
        items=invoice.items,
        taxes=taxes,
        payments=invoice.payments,
        methods=[
            {"label": m.label, "type": m.type.value, "rows": _payment_rows(m.details)}
            for m in invoice.payment_methods
        ],
        watermark=_STATUS_LABELS.get(invoice.status),
        overdue=invoice.is_overdue,
        reference=_reference_line(invoice, rates),
        disclaimer=PAYMENT_DISCLAIMER,
        money=lambda v: format_money(v, cur),
        date=format_date,
    )
    buffer = BytesIO()
    result = pisa.CreatePDF(html, dest=buffer, encoding="utf-8")
    if result.err:
        raise PdfRenderError(f"Could not render invoice {invoice.invoice_number}")
    return buffer.getvalue()


def pdf_response(invoice: Invoice, rates: Optional[Mapping[str, Any]] = None) -> Response:
    """``application/pdf`` response named ``<invoice_number>.pdf``."""
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", invoice.invoice_number)
    return Response(
        content=render_invoice_pdf(invoice, rates),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe}.pdf"'},
    )
