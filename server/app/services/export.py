"""Full data export: serialisation and ZIP building. No DB access, so
``build_zip`` is safe to run in a worker thread.

Rows are serialised straight from the ORM columns (snake_case, full
fidelity). ``EncryptedText`` columns already decrypt on load, so tax IDs and
payment details come out in the clear; secrets are dropped by ``SECRET_COLUMNS``.
"""

from __future__ import annotations

import csv
import enum
import io
import json
import re
import tempfile
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable, Mapping, Optional

from sqlalchemy import inspect as sa_inspect

from app.models.Invoice import Invoice
from app.services.pdf import render_invoice_pdf

# Never leave the server, whatever table they sit on.
SECRET_COLUMNS = frozenset(
    {"hashed_password", "token", "jti", "access_token_id", "refresh_token"}
)
# Columns holding a JSON document stored as text (encrypted payment details).
_JSON_TEXT_COLUMNS = frozenset({"details"})

# Flat tables people open in a spreadsheet: file stem -> columns.
CSV_COLUMNS: dict[str, list[str]] = {
    "invoices": [
        "id", "invoice_number", "status", "client_id", "project_id", "currency",
        "issue_date", "due_date", "subtotal", "discount_amount", "tax_amount",
        "withholding_amount", "total", "amount_paid", "balance_due", "notes",
        "sent_at", "payment_at", "created_at",
    ],
    "payments": [
        "id", "invoice_id", "invoice_number", "amount", "method", "paid_at",
        "reference", "created_at",
    ],
    "time_entries": [
        "id", "project_id", "milestone_id", "description", "start_time",
        "end_time", "duration_minutes", "is_billable", "is_invoiced",
        "hourly_rate",
    ],
    "expenses": [
        "id", "project_id", "description", "category", "vendor", "amount",
        "currency", "incurred_on", "is_recurring", "recurrence", "notes",
    ],
}


@dataclass
class ExportData:
    """Everything to export. ``tables`` holds plain dicts, ``invoices`` the
    fully loaded ORM invoices the PDF renderer needs."""

    tables: dict[str, Any]
    invoices: list[Invoice]
    rates: Optional[Mapping[str, Any]] = None
    app_version: str = ""
    exported_at: datetime = field(default_factory=datetime.now)


def jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Mapping):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def row_to_dict(obj: Any, *, exclude: Iterable[str] = ()) -> dict[str, Any]:
    """All loaded column values of an ORM row, minus secrets and ``exclude``."""
    skip = SECRET_COLUMNS | set(exclude)
    out: dict[str, Any] = {}
    for attr in sa_inspect(obj).mapper.column_attrs:
        if attr.key in skip:
            continue
        value = getattr(obj, attr.key)
        if attr.key in _JSON_TEXT_COLUMNS and isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                pass
        out[attr.key] = jsonable(value)
    return out


def invoice_to_dict(invoice: Invoice) -> dict[str, Any]:
    data = row_to_dict(invoice)
    data["amount_paid"] = jsonable(invoice.amount_paid)
    data["balance_due"] = jsonable(invoice.balance_due)
    data["items"] = [row_to_dict(i) for i in invoice.items]
    data["taxes"] = [
        row_to_dict(t) for t in sorted(invoice.taxes, key=lambda t: t.sort_order)
    ]
    data["payments"] = [row_to_dict(p) for p in invoice.payments]
    data["payment_methods"] = [
        row_to_dict(m)
        for m in sorted(invoice.payment_methods, key=lambda m: m.sort_order)
    ]
    return data


_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def csv_cell(value: Any) -> Any:
    """Neutralise spreadsheet formulas in user-supplied text."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value


def write_csv(rows: list[dict[str, Any]], columns: list[str]) -> bytes:
    buf = io.StringIO(newline="")
    writer = csv.writer(buf)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([csv_cell(row.get(c)) for c in columns])
    return buf.getvalue().encode("utf-8-sig")


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, indent=2, ensure_ascii=False).encode("utf-8")


def pdf_names(invoices: Iterable[Invoice]) -> dict[uuid.UUID, str]:
    """Unique ``invoices/<number>.pdf`` path per invoice id."""
    used: set[str] = set()
    names: dict[uuid.UUID, str] = {}
    for inv in invoices:
        stem = re.sub(r"[^A-Za-z0-9._-]", "_", inv.invoice_number)
        name, n = stem, 1
        while name.lower() in used:
            n += 1
            name = f"{stem}-{n}"
        used.add(name.lower())
        names[inv.id] = f"invoices/{name}.pdf"
    return names


def build_zip(data: ExportData) -> tempfile.SpooledTemporaryFile:
    """Write the export archive; the returned file is positioned at 0."""
    spool = tempfile.SpooledTemporaryFile(max_size=16 * 1024 * 1024)
    counts = {
        name: len(rows) if isinstance(rows, list) else 1
        for name, rows in data.tables.items()
    }
    pdf_failures: list[str] = []
    paths = pdf_names(data.invoices)
    pdf_count = 0

    with zipfile.ZipFile(spool, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, rows in data.tables.items():
            zf.writestr(f"{name}.json", _json_bytes(rows))
        for name, columns in CSV_COLUMNS.items():
            zf.writestr(f"{name}.csv", write_csv(data.tables[name], columns))
        for inv in data.invoices:
            try:
                zf.writestr(paths[inv.id], render_invoice_pdf(inv, data.rates))
                pdf_count += 1
            except Exception:  # one bad invoice must not sink the export
                pdf_failures.append(inv.invoice_number)
        zf.writestr(
            "manifest.json",
            _json_bytes(
                {
                    "exported_at": data.exported_at.isoformat(),
                    "app_version": data.app_version,
                    "counts": {**counts, "invoice_pdfs": pdf_count},
                    "pdf_failures": pdf_failures,
                }
            ),
        )
    spool.seek(0)
    return spool
