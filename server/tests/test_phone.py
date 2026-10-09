"""Step 11: WhatsApp number normalization."""

import pytest

from app.services.phone import normalize_whatsapp, wa_digits


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("03001234567", "+923001234567"),
        ("0300-123 4567", "+923001234567"),
        ("00923001234567", "+923001234567"),
        ("+923001234567", "+923001234567"),
        ("+1 (415) 555-0123", "+14155550123"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_normalize_whatsapp(raw, expected):
    assert normalize_whatsapp(raw) == expected


@pytest.mark.parametrize("raw", ["abc", "0300123", "923001234567", "+0123456789", "+12", "0412345678"])
def test_normalize_whatsapp_rejects_invalid(raw):
    with pytest.raises(ValueError):
        normalize_whatsapp(raw)


def test_wa_digits():
    assert wa_digits("+923001234567") == "923001234567"
