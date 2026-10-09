"""Pure builders for WhatsApp share links and message text. No I/O."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping, Optional
from urllib.parse import quote

from app.services.fx import REFERENCE_NOTE, convert_for_display, display_currency_for
from app.services.phone import wa_digits


def build_whatsapp_url(number: Optional[str], text: str) -> str:
    """``wa.me`` link; ``number`` is E.164 or None (the user picks the chat)."""
    target = wa_digits(number) if number else ""
    return f"https://wa.me/{target}?text={quote(text, safe='')}"


def _amount_line(amount: Decimal, currency: str, rates: Optional[Mapping[str, Any]]) -> str:
    line = f"{currency} {amount:,.2f}"
    other = display_currency_for(currency)
    shown = convert_for_display(amount, currency, other, rates) if other and rates else None
    if shown is not None:
        line += f" (about {shown.currency} {shown.amount:,.2f}. {REFERENCE_NOTE})"
    return line


def invoice_message(
    *,
    client_name: str,
    invoice_number: str,
    amount: Decimal,
    currency: str,
    due_date,
    portal_link: str,
    issuer_name: str,
    rates: Optional[Mapping[str, Any]] = None,
    reminder: bool = False,
    overdue: bool = False,
) -> str:
    if reminder:
        intro = (
            f"This is a reminder that invoice {invoice_number} is overdue."
            if overdue
            else f"This is a friendly reminder about invoice {invoice_number}."
        )
        amount_label = "Balance due"
    else:
        intro = f"Please find invoice {invoice_number} from {issuer_name}."
        amount_label = "Amount"
    lines = [f"Hello {client_name},", "", intro, f"{amount_label}: {_amount_line(amount, currency, rates)}"]
    if due_date:
        lines.append(f"Due date: {due_date.isoformat()}")
    lines += ["", f"View the invoice: {portal_link}"]
    return "\n".join(lines)
