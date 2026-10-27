"""Step 16: full data export (POST /export)."""

import csv
import io
import json
import zipfile
from datetime import UTC, date, datetime, timedelta

from pypdf import PdfReader
from sqlalchemy import select

from app.core.config import settings
from app.models.ActivityEvent import ActivityEvent
from app.models.RefreshToken import RefreshToken
from tests.test_invoice_pdf import INVOICES_URL, _invoice
from tests.test_payment_methods import VALID, body

URL = "/api/v1/export"
PASSWORD = "Passw0rd1"


def _zip(response) -> zipfile.ZipFile:
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def _json(zf: zipfile.ZipFile, name: str):
    return json.loads(zf.read(name))


def _csv_rows(zf: zipfile.ZipFile, name: str) -> list[dict]:
    text = zf.read(name).decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


async def _populate(client, headers, project):
    pm = await client.post(
        "/api/v1/payment-methods", json=body("PAYONEER", VALID["PAYONEER"]), headers=headers
    )
    assert pm.status_code == 201, pm.text
    start = datetime(2026, 1, 1, 9, 0, tzinfo=UTC)
    te = await client.post(
        "/api/v1/time-entries",
        json={
            "description": "=HYPERLINK(\"http://evil\")",
            "startTime": start.isoformat(),
            "endTime": (start + timedelta(hours=2)).isoformat(),
            "isBillable": True,
            "projectId": str(project.id),
        },
        headers=headers,
    )
    assert te.status_code == 201, te.text
    inv = await _invoice(client, headers, project.id)
    sent = await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=headers)
    assert sent.status_code == 200, sent.text
    pay = await client.post(
        f"{INVOICES_URL}/{inv['id']}/payments", json={"amount": "50"}, headers=headers
    )
    assert pay.status_code == 201, pay.text
    exp = await client.post(
        "/api/v1/expenses",
        json={"description": "Figma", "amount": "100", "incurredOn": date.today().isoformat()},
        headers=headers,
    )
    assert exp.status_code == 201, exp.text
    rem = await client.post(
        "/api/v1/tax/remittances",
        json={
            "periodStart": (date.today() - timedelta(days=30)).isoformat(),
            "periodEnd": date.today().isoformat(),
            "amount": "10",
        },
        headers=headers,
    )
    assert rem.status_code == 201, rem.text
    cr = await client.post(
        "/api/v1/change-requests",
        json={"projectId": str(project.id), "title": "Add blog", "estimatedAmount": "1500"},
        headers=headers,
    )
    assert cr.status_code == 201, cr.text
    return inv


async def test_export_contents_and_counts(client, auth_headers, project, user):
    inv = await _populate(client, auth_headers, project)

    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    names = set(zf.namelist())
    assert {
        "manifest.json", "profile.json", "clients.json", "projects.json",
        "milestones.json", "time_entries.json", "invoices.json", "payments.json",
        "expenses.json", "tax_remittances.json", "change_requests.json",
        "payment_methods.json", "activity.json",
        "invoices.csv", "payments.csv", "time_entries.csv", "expenses.csv",
    } <= names

    manifest = _json(zf, "manifest.json")
    counts = manifest["counts"]
    assert manifest["app_version"] and manifest["exported_at"]
    assert counts["clients"] == 1 and counts["projects"] == 1
    assert counts["time_entries"] == 1 and counts["invoices"] == 1
    assert counts["payments"] == 1 and counts["expenses"] == 1
    assert counts["tax_remittances"] == 1 and counts["change_requests"] == 1
    assert counts["payment_methods"] == 1 and counts["invoice_pdfs"] == 1
    assert manifest["pdf_failures"] == []

    invoices = _json(zf, "invoices.json")
    assert len(invoices) == 1 and len(invoices[0]["items"]) == 1
    assert len(invoices[0]["payments"]) == 1
    assert len(_csv_rows(zf, "invoices.csv")) == 1
    assert len(_csv_rows(zf, "payments.csv")) == 1
    assert len(_csv_rows(zf, "time_entries.csv")) == 1
    assert len(_csv_rows(zf, "expenses.csv")) == 1

    pdf_name = f"invoices/{inv['invoiceNumber']}.pdf"
    assert pdf_name in names
    assert PdfReader(io.BytesIO(zf.read(pdf_name))).pages


async def test_export_decrypts_payment_details(client, auth_headers, project):
    await _populate(client, auth_headers, project)
    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    methods = _json(zf, "payment_methods.json")
    assert methods[0]["details"]["accountEmail"] == "me@example.com"


async def test_export_has_no_secrets(client, auth_headers, project, user, db_session):
    await _populate(client, auth_headers, project)
    db_session.add(RefreshToken(user_id=user.id, token="refresh-secret-token-value",
                                expires_at=datetime.now(UTC) + timedelta(days=1)))
    await db_session.commit()
    sent = await client.post(
        f"{INVOICES_URL}/{(await client.get(INVOICES_URL, headers=auth_headers)).json()['invoices'][0]['id']}/send",
        headers=auth_headers,
    )
    token = sent.json().get("portalUrl", "").split("token=", 1)[-1]

    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    for name in zf.namelist():
        blob = zf.read(name)
        assert user.hashed_password.encode() not in blob, name
        assert b"refresh-secret-token-value" not in blob, name
        assert b"hashed_password" not in blob, name
        if token:
            assert token.encode() not in blob, name


async def test_wrong_password_refused_and_builds_nothing(client, auth_headers, project, db_session):
    resp = await client.post(URL, json={"password": "Wrong-pass1"}, headers=auth_headers)
    assert resp.status_code == 403
    assert resp.headers["content-type"].startswith("application/json")
    rows = (
        await db_session.execute(select(ActivityEvent).where(ActivityEvent.entity_type == "export"))
    ).scalars().all()
    assert rows == []


async def test_export_logs_activity(client, auth_headers, project, db_session):
    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    assert zf.namelist()
    rows = (
        await db_session.execute(select(ActivityEvent).where(ActivityEvent.entity_type == "export"))
    ).scalars().all()
    assert [r.action for r in rows] == ["export"]


async def test_export_requires_auth(client):
    assert (await client.post(URL, json={"password": PASSWORD})).status_code == 401


async def test_export_excludes_other_users_data(
    client, auth_headers, other_auth_headers, other_user, project, db_session,
    make_client_profile, make_project,
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id, name="Not Mine Ltd")
    await make_project(client_id=theirs.id, created_by=other_user.id, name="Not Mine Project")
    await client.post(
        "/api/v1/expenses",
        json={"description": "TheirExpense", "amount": "5", "incurredOn": date.today().isoformat()},
        headers=other_auth_headers,
    )

    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    everything = b"".join(zf.read(n) for n in zf.namelist() if n.endswith((".json", ".csv")))
    assert b"Not Mine" not in everything and b"TheirExpense" not in everything
    assert _json(zf, "manifest.json")["counts"]["expenses"] == 0


async def test_csv_neutralises_formulas(client, auth_headers, project):
    await _populate(client, auth_headers, project)
    zf = _zip(await client.post(URL, json={"password": PASSWORD}, headers=auth_headers))
    row = _csv_rows(zf, "time_entries.csv")[0]
    assert row["description"].startswith("'=")
    # JSON keeps the original text.
    assert _json(zf, "time_entries.json")[0]["description"].startswith("=")


async def test_export_is_rate_limited(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "EXPORT_RATE_LIMIT", 2)
    for _ in range(2):
        assert (
            await client.post(URL, json={"password": "Wrong-pass1"}, headers=auth_headers)
        ).status_code == 403
    limited = await client.post(URL, json={"password": PASSWORD}, headers=auth_headers)
    assert limited.status_code == 429
