"""Freelancer payment methods: validation per type, encryption, ownership, ordering."""

import copy

import pytest
from sqlalchemy import select, text

from app.core.security import create_access_token
from app.core.sensitive import _FERNET
from app.db.crud import reference
from app.models.ActivityEvent import ActivityEvent
from app.models.User import UserRole

URL = "/api/v1/payment-methods"
PK_IBAN = "PK36SCBL0000001123456702"
GB_IBAN = "GB82WEST12345698765432"
DE_IBAN = "DE89370400440532013000"

VALID: dict[str, dict] = {
    "PAYONEER": {"accountEmail": "me@example.com", "paymentRequestUrl": "https://payoneer.com/pay/me"},
    "ESFCA_WIRE": {
        "beneficiaryName": "Ali Khan",
        "bankName": "Standard Chartered",
        "iban": PK_IBAN,
        "swiftBic": "SCBLPKKA",
        "bankAddress": "I.I. Chundrigar Road, Karachi",
    },
    "ELEVATE_PAY": {
        "accountHolder": "Ali Khan",
        "accountNumber": "123456789",
        "routingNumber": "021000021",
        "bankName": "JPMorgan Chase",
        "accountType": "CHECKING",
    },
    "WISE_TO_IBAN": {"beneficiaryName": "Ali Khan", "iban": GB_IBAN, "bankName": "Wise", "note": "Use USD"},
    "PKR_BANK_TRANSFER": {"accountTitle": "Ali Khan", "bankName": "Meezan", "iban": PK_IBAN},
    "RAAST": {"accountTitle": "Ali Khan", "raastId": "03001234567"},
    "JAZZCASH": {"mobileNumber": "03001234567", "accountTitle": "Ali Khan"},
    "EASYPAISA": {"mobileNumber": "0345-1234567", "accountTitle": "Ali Khan"},
    "OTHER": {"instructions": "Pay by cash on delivery"},
}

BANK_COMMON = {"accountHolder": "Jane Doe", "bankName": "Some Bank"}
BANK_VALID: dict[str, dict] = {
    "IBAN": {"country": "DE", "currency": "EUR", "scheme": "IBAN", "iban": DE_IBAN, "swiftBic": "DEUTDEFF"},
    "ACH": {
        "country": "US", "currency": "USD", "scheme": "ACH",
        "routingNumber": "021000021", "accountNumber": "123456789", "accountType": "SAVINGS",
    },
    "UK_SORT_CODE": {
        "country": "GB", "currency": "GBP", "scheme": "UK_SORT_CODE",
        "sortCode": "12-34-56", "accountNumber": "12345678",
    },
    "SWIFT_OTHER": {
        "country": "NG", "currency": "USD", "scheme": "SWIFT_OTHER",
        "accountNumber": "0123456789", "swiftBic": "ZEIBNGLA",
    },
}


def body(type_, details, **extra):
    return {"type": type_, "label": f"My {type_}", "details": details, **extra}


def bank(base, **override):
    details = {**BANK_COMMON, **copy.deepcopy(BANK_VALID[base])}
    details.update(override)
    return body("BANK_TRANSFER", {k: v for k, v in details.items() if v is not None})


async def create(client, headers, payload):
    return await client.post(URL, json=payload, headers=headers)


@pytest.fixture
async def seeded(db_session):
    await reference.seed_reference_settings(db_session)


# ── Valid payloads ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("type_", list(VALID))
async def test_create_each_type(client, auth_headers, seeded, type_):
    resp = await create(client, auth_headers, body(type_, VALID[type_]))
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["type"] == type_
    got = data["details"]
    for key, value in VALID[type_].items():
        if key in ("mobileNumber",):
            continue  # normalized, asserted separately
        assert got[key] == value
    fetched = await client.get(f"{URL}/{data['id']}", headers=auth_headers)
    assert fetched.json()["details"] == got


@pytest.mark.parametrize("scheme", list(BANK_VALID))
async def test_create_bank_transfer_schemes(client, auth_headers, scheme):
    resp = await create(client, auth_headers, bank(scheme))
    assert resp.status_code == 201, resp.text
    assert resp.json()["details"]["scheme"] == scheme


async def test_payoneer_accepts_email_only_or_url_only(client, auth_headers):
    assert (await create(client, auth_headers, body("PAYONEER", {"accountEmail": "a@b.co"}))).status_code == 201
    url_only = {"paymentRequestUrl": "https://payoneer.com/x"}
    assert (await create(client, auth_headers, body("PAYONEER", url_only))).status_code == 201


async def test_raast_accepts_iban_only(client, auth_headers):
    resp = await create(client, auth_headers, body("RAAST", {"accountTitle": "A", "iban": PK_IBAN}))
    assert resp.status_code == 201, resp.text


# ── Invalid payloads ──────────────────────────────────────────────────────────


def _mut(type_, **changes):
    details = {**VALID[type_], **changes}
    return body(type_, {k: v for k, v in details.items() if v is not None})


INVALID = {
    "bad-iban-checksum": _mut("ESFCA_WIRE", iban="PK00SCBL0000001123456702"),
    "esfca-non-pk-iban": _mut("ESFCA_WIRE", iban=GB_IBAN),
    "esfca-missing-bic": _mut("ESFCA_WIRE", swiftBic=None),
    "esfca-bad-bic": _mut("ESFCA_WIRE", swiftBic="XX"),
    "pkr-non-pk-iban": _mut("PKR_BANK_TRANSFER", iban=DE_IBAN),
    "elevate-bad-aba": _mut("ELEVATE_PAY", routingNumber="021000022"),
    "elevate-bad-account-type": _mut("ELEVATE_PAY", accountType="CURRENT"),
    "payoneer-http-url": body("PAYONEER", {"paymentRequestUrl": "http://payoneer.com/x"}),
    "payoneer-neither": body("PAYONEER", {"bankName": "Meezan"}),
    "payoneer-bad-email": body("PAYONEER", {"accountEmail": "not-an-email"}),
    "raast-neither": body("RAAST", {"accountTitle": "A"}),
    "jazzcash-bad-mobile": _mut("JAZZCASH", mobileNumber="+14155552671"),
    "easypaisa-landline": _mut("EASYPAISA", mobileNumber="0421234567"),
    "wise-bad-iban": _mut("WISE_TO_IBAN", iban="GB82WEST12345698765433"),
    "other-empty": body("OTHER", {"instructions": ""}),
    "unknown-extra-field": _mut("JAZZCASH", cvv="123"),
    "wrong-shape-for-type": body("JAZZCASH", VALID["ESFCA_WIRE"]),
    "empty-details": body("RAAST", {}),
    "card-number-in-label": {**body("OTHER", VALID["OTHER"]), "label": "Card 4111 1111 1111 1111"},
    "card-number-in-details": body("OTHER", {"instructions": "Pay to 4111 1111 1111 1111"}),
    "cnic-in-details": body("JAZZCASH", {**VALID["JAZZCASH"], "accountTitle": "CNIC 35202-1234567-1"}),
    "blank-label": {**body("OTHER", VALID["OTHER"]), "label": ""},
    "unknown-type": body("STRIPE_LINK", {"instructions": "x"}),
    "bad-currency": {**body("OTHER", VALID["OTHER"]), "currency": "XXXX"},
    # BANK_TRANSFER
    "bank-iban-bad-checksum": bank("IBAN", iban="DE89370400440532013001"),
    "bank-iban-missing": bank("IBAN", iban=None),
    "bank-iban-country-mismatch": bank("IBAN", country="FR"),
    "bank-iban-wrong-length": bank("IBAN", iban="DE8937040044053201300"),
    "bank-ach-bad-aba": bank("ACH", routingNumber="021000022"),
    "bank-ach-short-aba": bank("ACH", routingNumber="02100002"),
    "bank-ach-bad-account-type": bank("ACH", accountType="CURRENT"),
    "bank-ach-account-too-short": bank("ACH", accountNumber="123"),
    "bank-ach-account-too-long": bank("ACH", accountNumber="1" * 18),
    "bank-sort-malformed": bank("UK_SORT_CODE", sortCode="12-3-456"),
    "bank-sort-account-short": bank("UK_SORT_CODE", accountNumber="1234567"),
    "bank-swift-missing-bic": bank("SWIFT_OTHER", swiftBic=None),
    "bank-swift-bad-bic": bank("SWIFT_OTHER", swiftBic="ABC"),
    "bank-swift-missing-account": bank("SWIFT_OTHER", accountNumber=None),
    "bank-bad-country": bank("IBAN", country="DEU"),
    "bank-unknown-scheme": bank("IBAN", scheme="CRYPTO"),
    "bank-field-of-another-scheme": bank("ACH", sortCode="123456"),
    "bank-missing-currency": bank("IBAN", currency=None),
}


@pytest.mark.parametrize("name", list(INVALID))
async def test_invalid_payloads_rejected(client, auth_headers, name):
    resp = await create(client, auth_headers, INVALID[name])
    assert resp.status_code == 422, (name, resp.text)
    assert (await client.get(URL, headers=auth_headers)).json()["paymentMethods"] == []


# ── Normalization ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw", ["03001234567", "+923001234567", "0300 1234567", "0092-300-1234567"]
)
async def test_mobile_normalized(client, auth_headers, raw):
    resp = await create(client, auth_headers, body("JAZZCASH", {"mobileNumber": raw, "accountTitle": "A"}))
    assert resp.json()["details"]["mobileNumber"] == "+923001234567"


async def test_sort_code_and_iban_normalized(client, auth_headers):
    resp = await create(client, auth_headers, bank("UK_SORT_CODE"))
    assert resp.json()["details"]["sortCode"] == "123456"
    resp = await create(client, auth_headers, bank("IBAN", iban="de89 3704 0044 0532 0130 00", country="de"))
    assert resp.status_code == 201, resp.text
    assert resp.json()["details"]["iban"] == DE_IBAN
    assert resp.json()["details"]["country"] == "DE"


# ── ESFCA purpose-of-payment default ──────────────────────────────────────────


async def test_esfca_purpose_defaults_from_reference_setting(client, auth_headers, seeded):
    resp = await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))
    assert resp.json()["details"]["purposeOfPayment"] == "Payment for IT / software services export"


async def test_esfca_purpose_follows_admin_edit(client, auth_headers, seeded, db_session):
    await reference.set_setting(db_session, reference.PAYMENT_TEXTS, {"esfca_purpose_of_payment": "Consulting export"})
    resp = await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))
    assert resp.json()["details"]["purposeOfPayment"] == "Consulting export"


async def test_esfca_explicit_purpose_wins(client, auth_headers, seeded):
    details = {**VALID["ESFCA_WIRE"], "purposeOfPayment": "Custom wording"}
    resp = await create(client, auth_headers, body("ESFCA_WIRE", details))
    assert resp.json()["details"]["purposeOfPayment"] == "Custom wording"


async def test_esfca_purpose_has_fallback_without_seed(client, auth_headers):
    resp = await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))
    assert resp.status_code == 201
    assert resp.json()["details"]["purposeOfPayment"]


async def test_esfca_purpose_refilled_after_details_patch(client, auth_headers, seeded):
    created = (await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))).json()
    resp = await client.patch(f"{URL}/{created['id']}", json={"details": VALID["ESFCA_WIRE"]}, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["details"]["purposeOfPayment"]


# ── Encryption at rest and audit redaction ────────────────────────────────────


async def test_details_encrypted_at_rest(client, auth_headers, db_session):
    resp = await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))
    assert resp.status_code == 201
    raw = (await db_session.execute(text("SELECT details FROM payment_method_configs"))).scalar_one()
    assert PK_IBAN not in raw and "SCBLPKKA" not in raw and "Ali Khan" not in raw
    assert PK_IBAN in _FERNET.decrypt(raw.encode()).decode()
    assert resp.json()["details"]["iban"] == PK_IBAN


async def test_activity_feed_never_contains_details(client, auth_headers, db_session):
    created = (await create(client, auth_headers, body("ESFCA_WIRE", VALID["ESFCA_WIRE"]))).json()
    new_details = {**VALID["ESFCA_WIRE"], "bankName": "Other Bank"}
    resp = await client.patch(
        f"{URL}/{created['id']}", json={"details": new_details, "label": "Renamed"}, headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    await client.delete(f"{URL}/{created['id']}", headers=auth_headers)

    events = (await db_session.execute(select(ActivityEvent))).scalars().all()
    pm = [e for e in events if e.entity_type == "payment_method"]
    assert [e.action for e in sorted(pm, key=lambda e: e.created_at)] == ["created", "updated", "deleted"]
    dump = str([(e.summary, e.changes) for e in pm])
    for secret in (PK_IBAN, "SCBLPKKA", "Ali Khan", "Chundrigar"):
        assert secret not in dump
    updated = next(e for e in pm if e.action == "updated")
    assert updated.changes["details"] == {"old": "[redacted]", "new": "[redacted]"}
    assert updated.changes["label"]["new"] == "Renamed"


# ── Ownership / auth ──────────────────────────────────────────────────────────


async def test_requires_auth(client):
    assert (await client.get(URL)).status_code == 401
    assert (await client.post(URL, json=body("OTHER", VALID["OTHER"]))).status_code == 401


async def test_requires_freelancer_profile(client, make_user):
    user = await make_user(with_freelancer=False)
    headers = {"Authorization": f"Bearer {create_access_token(user.id)}"}
    assert (await client.get(URL, headers=headers)).status_code == 403
    assert (await create(client, headers, body("OTHER", VALID["OTHER"]))).status_code == 403


async def test_other_user_cannot_see_or_touch(client, auth_headers, other_auth_headers):
    mine = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    mid = mine["id"]
    assert (await client.get(URL, headers=other_auth_headers)).json()["paymentMethods"] == []
    assert (await client.get(f"{URL}/{mid}", headers=other_auth_headers)).status_code == 404
    patch = await client.patch(f"{URL}/{mid}", json={"label": "pwned"}, headers=other_auth_headers)
    assert patch.status_code == 404
    assert (await client.delete(f"{URL}/{mid}", headers=other_auth_headers)).status_code == 404
    still = (await client.get(f"{URL}/{mid}", headers=auth_headers)).json()
    assert still["label"] == mine["label"]


async def test_unknown_id_404(client, auth_headers):
    assert (await client.get(f"{URL}/00000000-0000-0000-0000-000000000000", headers=auth_headers)).status_code == 404


# ── Defaults, activation, patch rules ─────────────────────────────────────────


async def test_first_method_is_default_later_ones_are_not(client, auth_headers):
    first = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    second = (await create(client, auth_headers, body("JAZZCASH", VALID["JAZZCASH"]))).json()
    assert first["isDefault"] is True
    assert second["isDefault"] is False


async def test_multiple_defaults_allowed_and_toggle(client, auth_headers):
    await create(client, auth_headers, body("OTHER", VALID["OTHER"]))
    second = (await create(client, auth_headers, body("JAZZCASH", VALID["JAZZCASH"], isDefault=True))).json()
    assert second["isDefault"] is True
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["isDefault"] for m in listing] == [True, True]
    resp = await client.patch(f"{URL}/{second['id']}", json={"isDefault": False}, headers=auth_headers)
    assert resp.json()["isDefault"] is False


async def test_deactivating_clears_default(client, auth_headers):
    created = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    assert created["isDefault"] is True
    resp = await client.patch(f"{URL}/{created['id']}", json={"isActive": False}, headers=auth_headers)
    assert resp.json()["isActive"] is False and resp.json()["isDefault"] is False
    # Cannot be re-marked default while inactive.
    resp = await client.patch(f"{URL}/{created['id']}", json={"isDefault": True}, headers=auth_headers)
    assert resp.json()["isDefault"] is False


async def test_include_inactive_filter(client, auth_headers):
    a = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    await create(client, auth_headers, body("JAZZCASH", VALID["JAZZCASH"]))
    await client.patch(f"{URL}/{a['id']}", json={"isActive": False}, headers=auth_headers)
    all_ = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    active = (await client.get(f"{URL}?include_inactive=false", headers=auth_headers)).json()["paymentMethods"]
    assert len(all_) == 2 and len(active) == 1


async def test_type_is_immutable(client, auth_headers):
    created = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    resp = await client.patch(f"{URL}/{created['id']}", json={"type": "RAAST"}, headers=auth_headers)
    assert resp.status_code == 422
    assert (await client.get(f"{URL}/{created['id']}", headers=auth_headers)).json()["type"] == "OTHER"


async def test_patch_details_validated_against_stored_type(client, auth_headers):
    created = (await create(client, auth_headers, body("JAZZCASH", VALID["JAZZCASH"]))).json()
    bad = await client.patch(f"{URL}/{created['id']}", json={"details": {"instructions": "x"}}, headers=auth_headers)
    assert bad.status_code == 422
    bad = await client.patch(
        f"{URL}/{created['id']}", json={"details": {"mobileNumber": "123", "accountTitle": "A"}}, headers=auth_headers
    )
    assert bad.status_code == 422
    ok = await client.patch(
        f"{URL}/{created['id']}", json={"details": {"mobileNumber": "03451234567", "accountTitle": "B"}}, headers=auth_headers
    )
    assert ok.status_code == 200
    assert ok.json()["details"] == {"mobileNumber": "+923451234567", "accountTitle": "B"}


@pytest.mark.parametrize("field", ["label", "isDefault", "isActive", "details"])
async def test_patch_null_rejected_for_required_fields(client, auth_headers, field):
    created = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    resp = await client.patch(f"{URL}/{created['id']}", json={field: None}, headers=auth_headers)
    assert resp.status_code == 422


async def test_patch_label_and_currency(client, auth_headers):
    created = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    resp = await client.patch(f"{URL}/{created['id']}", json={"label": "New", "currency": "pkr"}, headers=auth_headers)
    assert resp.json()["label"] == "New" and resp.json()["currency"] == "PKR"


async def test_delete(client, auth_headers):
    created = (await create(client, auth_headers, body("OTHER", VALID["OTHER"]))).json()
    assert (await client.delete(f"{URL}/{created['id']}", headers=auth_headers)).status_code == 204
    assert (await client.get(f"{URL}/{created['id']}", headers=auth_headers)).status_code == 404


# ── Ordering ──────────────────────────────────────────────────────────────────


async def _three(client, headers):
    ids = []
    for t in ("OTHER", "JAZZCASH", "RAAST"):
        payload = body(t, {"instructions": "x"} if t == "OTHER" else {"mobileNumber": "03001234567", "accountTitle": "A"} if t == "JAZZCASH" else {"accountTitle": "A", "raastId": "r1"})
        ids.append((await create(client, headers, payload)).json()["id"])
    return ids


async def test_new_methods_are_appended(client, auth_headers):
    ids = await _three(client, auth_headers)
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["id"] for m in listing] == ids
    assert [m["sortOrder"] for m in listing] == [0, 1, 2]


async def test_reorder_persists(client, auth_headers):
    a, b, c = await _three(client, auth_headers)
    resp = await client.put(f"{URL}/order", json={"ids": [c, a, b]}, headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert [m["id"] for m in resp.json()["paymentMethods"]] == [c, a, b]
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["id"] for m in listing] == [c, a, b]


async def test_append_after_delete_keeps_order(client, auth_headers):
    a, b, c = await _three(client, auth_headers)
    await client.delete(f"{URL}/{b}", headers=auth_headers)
    d = (await create(client, auth_headers, body("OTHER", {"instructions": "y"}))).json()["id"]
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["id"] for m in listing] == [a, c, d]


@pytest.mark.parametrize("case", ["missing", "duplicate", "unknown", "empty"])
async def test_reorder_must_list_every_method_once(client, auth_headers, case):
    a, b, c = await _three(client, auth_headers)
    ids = {
        "missing": [a, b],
        "duplicate": [a, a, b, c],
        "unknown": [a, b, c, "00000000-0000-0000-0000-000000000000"],
        "empty": [],
    }[case]
    resp = await client.put(f"{URL}/order", json={"ids": ids}, headers=auth_headers)
    assert resp.status_code == 422
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["id"] for m in listing] == [a, b, c]


async def test_reorder_with_someone_elses_id_rejected(client, auth_headers, other_auth_headers):
    mine = await _three(client, auth_headers)
    theirs = (await create(client, other_auth_headers, body("OTHER", VALID["OTHER"]))).json()["id"]
    resp = await client.put(f"{URL}/order", json={"ids": [*mine, theirs]}, headers=auth_headers)
    assert resp.status_code == 422
    resp = await client.put(f"{URL}/order", json={"ids": [theirs]}, headers=other_auth_headers)
    assert resp.status_code == 200  # their own single method is fine
    # and the other user's order is unaffected
    listing = (await client.get(URL, headers=auth_headers)).json()["paymentMethods"]
    assert [m["id"] for m in listing] == mine
