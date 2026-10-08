"""Step 9: invoice PDF output (owner + portal)."""

from datetime import date
from decimal import Decimal
from io import BytesIO

from pypdf import PdfReader

from app.db.crud import reference as ref_crud
from tests.test_fx_display import RATES
from tests.test_payment_methods import VALID, body

INVOICES_URL = "/api/v1/invoices"
PORTAL_URL = "/api/v1/portal"
MISSING_ID = "00000000-0000-0000-0000-000000000000"


def _text(content: bytes) -> str:
    return " ".join(page.extract_text() for page in PdfReader(BytesIO(content)).pages)


async def _invoice(client, headers, project_id, **overrides):
    resp = await client.post(
        INVOICES_URL,
        json={
            "projectId": str(project_id),
            "items": [{"description": "Logo design", "quantity": "2", "unitPrice": "100"}],
            **overrides,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _pdf(client, headers, invoice_id) -> str:
    r = await client.get(f"{INVOICES_URL}/{invoice_id}/pdf", headers=headers)
    assert r.status_code == 200, r.text
    return _text(r.content)


async def _sent_token(client, headers, invoice_id):
    sent = await client.post(f"{INVOICES_URL}/{invoice_id}/send", headers=headers)
    return sent.json()["portalUrl"].split("token=", 1)[1]


async def test_owner_pdf_is_valid_and_named_after_invoice(client, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id, notes="Thanks for your business")
    r = await client.get(f"{INVOICES_URL}/{inv['id']}/pdf", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert f'filename="{inv["invoiceNumber"]}.pdf"' in r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF")
    text = _text(r.content)
    assert inv["invoiceNumber"] in text
    assert "Logo design" in text
    assert "Thanks for your business" in text
    assert "200.00 USD" in text


async def test_draft_is_labelled_and_sent_is_not(client, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    assert "DRAFT" in await _pdf(client, auth_headers, inv["id"])
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    assert "DRAFT" not in await _pdf(client, auth_headers, inv["id"])


async def test_pdf_includes_discount_tax_payments_and_balance(client, auth_headers, project):
    inv = await _invoice(
        client,
        auth_headers,
        project.id,
        discountRate="10",
        taxes=[{"name": "VAT", "rate": "5"}],
    )
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    paid = await client.post(
        f"{INVOICES_URL}/{inv['id']}/payments", json={"amount": "50"}, headers=auth_headers
    )
    assert paid.status_code in (200, 201), paid.text
    text = await _pdf(client, auth_headers, inv["id"])
    assert "Discount" in text and "VAT" in text
    assert "Amount paid" in text and "50.00 USD" in text
    # 200 - 10% = 180, +5% VAT = 189, minus 50 paid
    assert "Balance due" in text and "139.00 USD" in text


async def test_pdf_has_payment_block_with_disclaimer(client, auth_headers, project):
    created = await client.post(
        "/api/v1/payment-methods",
        json=body("ESFCA_WIRE", VALID["ESFCA_WIRE"]),
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    inv = await _invoice(
        client, auth_headers, project.id, paymentInstructions="Quote the invoice number"
    )
    await client.post(f"{INVOICES_URL}/{inv['id']}/send", headers=auth_headers)
    text = await _pdf(client, auth_headers, inv["id"])
    assert "does not process payments" in text
    assert VALID["ESFCA_WIRE"]["iban"].replace(" ", "") in text.replace(" ", "")
    assert "Quote the invoice number" in text


async def test_pdf_reference_line_for_usd_with_rates(client, db_session, auth_headers, project):
    await ref_crud.seed_reference_settings(db_session)
    await ref_crud.set_setting(
        db_session,
        ref_crud.EXCHANGE_RATES,
        {**RATES, "manual_override": True},
        reference_date=date(2025, 10, 5),
    )
    inv = await _invoice(client, auth_headers, project.id)  # 200 USD
    text = await _pdf(client, auth_headers, inv["id"])
    assert f"{Decimal('200') * Decimal('281.25'):,.2f} PKR" in text
    assert "Reference rate only" in text


async def test_pdf_omits_reference_line_without_rates_or_for_other_currency(
    client, auth_headers, project
):
    inv = await _invoice(client, auth_headers, project.id)
    assert "Reference rate only" not in await _pdf(client, auth_headers, inv["id"])
    eur = await _invoice(client, auth_headers, project.id, currency="EUR")
    assert "Reference rate only" not in await _pdf(client, auth_headers, eur["id"])


async def test_pdf_escapes_user_content(client, auth_headers, project):
    inv = await _invoice(
        client,
        auth_headers,
        project.id,
        items=[
            {
                "description": "<b>bold</b> & <i>x</i>",
                "quantity": "1",
                "unitPrice": "10",
            }
        ],
    )
    assert "<b>bold</b>" in await _pdf(client, auth_headers, inv["id"])


async def test_owner_pdf_requires_auth_and_ownership(
    client, auth_headers, other_auth_headers, project
):
    inv = await _invoice(client, auth_headers, project.id)
    url = f"{INVOICES_URL}/{inv['id']}/pdf"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, headers=other_auth_headers)).status_code in (403, 404)
    missing = await client.get(f"{INVOICES_URL}/{MISSING_ID}/pdf", headers=auth_headers)
    assert missing.status_code == 404


# -- portal -------------------------------------------------------------------


async def test_portal_pdf_works_and_does_not_stamp_a_view(client, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    token = await _sent_token(client, auth_headers, inv["id"])
    r = await client.get(f"{PORTAL_URL}/invoice/{inv['id']}/pdf", params={"token": token})
    assert r.status_code == 200, r.text
    assert r.content.startswith(b"%PDF")
    assert inv["invoiceNumber"] in _text(r.content)
    after = await client.get(f"{INVOICES_URL}/{inv['id']}", headers=auth_headers)
    assert after.json()["viewedAt"] is None


async def test_portal_pdf_requires_valid_token(client, auth_headers, project):
    inv = await _invoice(client, auth_headers, project.id)
    await _sent_token(client, auth_headers, inv["id"])
    url = f"{PORTAL_URL}/invoice/{inv['id']}/pdf"
    assert (await client.get(url)).status_code == 401
    assert (await client.get(url, params={"token": "nope"})).status_code == 401


async def test_portal_pdf_rejects_token_scoped_to_another_invoice(client, auth_headers, project):
    a = await _invoice(client, auth_headers, project.id)
    b = await _invoice(client, auth_headers, project.id)
    token_a = await _sent_token(client, auth_headers, a["id"])
    await _sent_token(client, auth_headers, b["id"])
    r = await client.get(f"{PORTAL_URL}/invoice/{b['id']}/pdf", params={"token": token_a})
    assert r.status_code == 403


async def test_portal_pdf_not_available_for_draft(client, auth_headers, project):
    sent = await _invoice(client, auth_headers, project.id)
    token = await _sent_token(client, auth_headers, sent["id"])
    draft = await _invoice(client, auth_headers, project.id)
    r = await client.get(f"{PORTAL_URL}/invoice/{draft['id']}/pdf", params={"token": token})
    assert r.status_code in (403, 404)
