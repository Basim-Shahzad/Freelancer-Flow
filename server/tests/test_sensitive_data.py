"""Sensitive data: payment references, payment instructions, encrypted tax IDs."""

import pytest
from sqlalchemy import select, text

from app.core.sensitive import (
    contains_card_number,
    contains_cnic,
    contains_iban,
    mask,
)
from app.models.ActivityEvent import ActivityEvent

INVOICES_URL = "/api/v1/invoices"
CLIENTS_URL = "/api/v1/clients"
PROFILE_URL = "/api/v1/profile"

CARD = "4111 1111 1111 1111"
IBAN = "PK36SCBL0000001123456702"
CNIC = "35202-1234567-1"


# ── Detectors ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("value", [CARD, "4111-1111-1111-1111", "paid with 5555555555554444 ok"])
def test_detects_card_numbers(value):
    assert contains_card_number(value)


@pytest.mark.parametrize("value", ["TX-1", "4111111111111112", "Order 20260115", "+92 300 1234567"])
def test_ignores_non_card_numbers(value):
    assert not contains_card_number(value)


@pytest.mark.parametrize("value", [IBAN, "GB82 WEST 1234 5698 7654 32", "iban gb82west12345698765432"])
def test_detects_ibans(value):
    assert contains_iban(value)


def test_ignores_invalid_iban_checksum():
    assert not contains_iban("PK00SCBL0000001123456702")


def test_detects_cnic():
    assert contains_cnic(f"CNIC {CNIC}")
    assert not contains_cnic("3520212345671")


def test_mask():
    assert mask("1234567-8") == "•••••67-8"
    assert mask("12") == "••"
    assert mask(None) is None


# ── Payment reference ─────────────────────────────────────────────────────────


async def _sent_invoice(client, headers, project_id):
    resp = await client.post(
        INVOICES_URL,
        json={
            "projectId": str(project_id),
            "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    invoice = resp.json()
    resp = await client.post(f"{INVOICES_URL}/{invoice['id']}/send", headers=headers)
    assert resp.status_code == 200, resp.text
    return invoice


@pytest.mark.parametrize("reference", [CARD, IBAN, CNIC])
async def test_payment_reference_rejects_sensitive_data(client, auth_headers, project, reference):
    invoice = await _sent_invoice(client, auth_headers, project.id)
    resp = await client.post(
        f"{INVOICES_URL}/{invoice['id']}/payments",
        json={"amount": "10", "reference": reference},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_payment_reference_accepts_transaction_id(client, auth_headers, project):
    invoice = await _sent_invoice(client, auth_headers, project.id)
    resp = await client.post(
        f"{INVOICES_URL}/{invoice['id']}/payments",
        json={"amount": "10", "reference": "RAAST-TX-998877"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text


# ── Payment instructions / notes ──────────────────────────────────────────────


async def test_invoice_uses_profile_payment_instructions(client, auth_headers, project):
    instructions = f"Bank transfer to Meezan Bank, IBAN {IBAN}"
    resp = await client.patch(
        PROFILE_URL, json={"paymentInstructions": instructions}, headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["paymentInstructions"] == instructions

    invoice = await _sent_invoice(client, auth_headers, project.id)
    assert invoice["paymentInstructions"] == instructions


async def test_invoice_payment_instructions_override_and_clear(client, auth_headers, project):
    await client.patch(PROFILE_URL, json={"paymentInstructions": "Default"}, headers=auth_headers)
    base = {
        "projectId": str(project.id),
        "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
    }
    resp = await client.post(
        INVOICES_URL, json={**base, "paymentInstructions": "Cash"}, headers=auth_headers
    )
    assert resp.json()["paymentInstructions"] == "Cash"
    resp = await client.post(
        INVOICES_URL, json={**base, "paymentInstructions": None}, headers=auth_headers
    )
    assert resp.json()["paymentInstructions"] is None


@pytest.mark.parametrize("field", ["notes", "paymentInstructions"])
@pytest.mark.parametrize("value", [f"card {CARD}", f"my CNIC {CNIC}"])
async def test_client_facing_text_rejects_card_and_cnic(client, auth_headers, project, field, value):
    resp = await client.post(
        INVOICES_URL,
        json={
            "projectId": str(project.id),
            "items": [{"description": "Design", "quantity": "1", "unitPrice": "100"}],
            field: value,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_profile_payment_instructions_reject_card(client, auth_headers):
    resp = await client.patch(
        PROFILE_URL, json={"paymentInstructions": f"Pay to {CARD}"}, headers=auth_headers
    )
    assert resp.status_code == 422


# ── Encrypted tax IDs ─────────────────────────────────────────────────────────


async def test_client_tax_id_encrypted_at_rest_and_masked_in_list(
    client, auth_headers, freelancer_profile, db_session
):
    resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme", "email": "acme@example.com", "taxId": "1234567-8"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["taxId"] == "1234567-8"

    raw = (await db_session.execute(
        text("SELECT tax_id FROM clients WHERE email = 'acme@example.com'")
    )).scalar_one()
    assert "1234567" not in raw

    detail = await client.get(f"{CLIENTS_URL}/{created['id']}", headers=auth_headers)
    assert detail.json()["taxId"] == "1234567-8"

    listing = await client.get(CLIENTS_URL, headers=auth_headers)
    assert listing.json()["clients"][0]["taxId"] == "•••••67-8"


async def test_tax_registration_number_encrypted_and_redacted_in_activity(
    client, auth_headers, freelancer_profile, db_session
):
    resp = await client.patch(
        PROFILE_URL, json={"taxRegistrationNumber": "NTN-7654321"}, headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["taxRegistrationNumber"] == "NTN-7654321"

    raw = (await db_session.execute(
        text("SELECT tax_registration_number FROM freelancers")
    )).scalar_one()
    assert "7654321" not in raw

    events = (await db_session.execute(select(ActivityEvent))).scalars().all()
    logged = [e.changes for e in events if e.changes and "tax_registration_number" in e.changes]
    assert logged
    assert "7654321" not in str(logged)


async def test_legacy_plaintext_tax_id_still_readable(
    client, auth_headers, freelancer_profile, db_session
):
    resp = await client.post(
        CLIENTS_URL, json={"name": "Old", "email": "old@example.com"}, headers=auth_headers
    )
    client_id = resp.json()["id"]
    await db_session.execute(
        text("UPDATE clients SET tax_id = 'PLAIN-123' WHERE email = 'old@example.com'")
    )
    await db_session.commit()

    detail = await client.get(f"{CLIENTS_URL}/{client_id}", headers=auth_headers)
    assert detail.json()["taxId"] == "PLAIN-123"
