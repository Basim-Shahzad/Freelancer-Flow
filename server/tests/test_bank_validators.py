"""Pure bank/wallet identifier validators."""

import pytest

from app.core import bank_validators as bv
from app.core.sensitive import contains_iban

VALID_IBANS = [
    "PK36SCBL0000001123456702",
    "GB82WEST12345698765432",
    "DE89370400440532013000",
    "FR1420041010050500013M02606",
    "AE070331234567890123456",
]


@pytest.mark.parametrize("iban", VALID_IBANS)
def test_valid_ibans(iban):
    assert bv.validate_iban(iban) == iban
    assert contains_iban(iban)


def test_iban_is_normalized():
    assert bv.validate_iban("gb82 west 1234 5698 7654 32") == "GB82WEST12345698765432"


@pytest.mark.parametrize(
    "iban",
    [
        "PK00SCBL0000001123456702",  # bad checksum
        "GB82WEST1234569876543",  # too short for GB
        "GB82WEST123456987654321",  # too long for GB
        "1234",
        "",
        "PK36SCBL000000112345670!",
    ],
)
def test_invalid_ibans(iban):
    with pytest.raises(ValueError):
        bv.validate_iban(iban)


def test_iban_country_mismatch():
    with pytest.raises(ValueError, match="does not match"):
        bv.validate_iban("GB82WEST12345698765432", country="US")
    assert bv.validate_iban("GB82WEST12345698765432", country="gb")


def test_pk_iban():
    assert bv.validate_pk_iban("PK36SCBL0000001123456702")
    with pytest.raises(ValueError):
        bv.validate_pk_iban("GB82WEST12345698765432")


@pytest.mark.parametrize("routing", ["021000021", "026009593", "011401533", "0210-00021"])
def test_valid_aba(routing):
    assert bv.validate_aba(routing).isdigit()


@pytest.mark.parametrize("routing", ["021000022", "12345678", "1234567890", "abcdefghi", ""])
def test_invalid_aba(routing):
    with pytest.raises(ValueError):
        bv.validate_aba(routing)


@pytest.mark.parametrize("raw, expected", [("12-34-56", "123456"), ("123456", "123456"), (" 12-34-56 ", "123456")])
def test_sort_code(raw, expected):
    assert bv.normalize_sort_code(raw) == expected


@pytest.mark.parametrize("raw", ["12-3-456", "12345", "1234567", "ab-cd-ef", "12 34 56"])
def test_bad_sort_code(raw):
    with pytest.raises(ValueError):
        bv.normalize_sort_code(raw)


@pytest.mark.parametrize("bic", ["SCBLPKKA", "scblpkka", "DEUTDEFF500", "DEUTDEFF"])
def test_valid_bic(bic):
    assert bv.validate_swift_bic(bic) == bic.upper()


@pytest.mark.parametrize("bic", ["SCBLPK", "SCBLPKKA5", "1234PKKA", "SCBLPKKA5000", ""])
def test_invalid_bic(bic):
    with pytest.raises(ValueError):
        bv.validate_swift_bic(bic)


@pytest.mark.parametrize(
    "raw",
    ["03001234567", "+923001234567", "923001234567", "00923001234567", "0300-1234567", "+92 300 1234567"],
)
def test_pk_mobile_normalized(raw):
    assert bv.normalize_pk_mobile(raw) == "+923001234567"


@pytest.mark.parametrize("raw", ["0200123456", "+14155552671", "030012345", "030012345678", "abc"])
def test_bad_pk_mobile(raw):
    with pytest.raises(ValueError):
        bv.normalize_pk_mobile(raw)


def test_https_url():
    assert bv.validate_https_url("https://payoneer.com/pay/abc")
    for bad in ("http://payoneer.com/x", "ftp://x.com", "javascript:alert(1)", "https://", "payoneer.com"):
        with pytest.raises(ValueError):
            bv.validate_https_url(bad)
