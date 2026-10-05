"""Pure validators/normalizers for bank and wallet identifiers.

Each ``validate_*`` / ``normalize_*`` returns the canonical form or raises
``ValueError`` (so they plug straight into Pydantic validators).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

# IBAN length per country (ISO 13616 registry, the commonly used subset).
IBAN_LENGTHS: dict[str, int] = {
    "AE": 23, "AT": 20, "AZ": 28, "BE": 16, "BG": 22, "BH": 22, "CH": 21,
    "CY": 28, "CZ": 24, "DE": 22, "DK": 18, "EE": 20, "ES": 24, "FI": 18,
    "FR": 27, "GB": 22, "GR": 27, "HR": 21, "HU": 28, "IE": 22, "IL": 23,
    "IS": 26, "IT": 27, "JO": 30, "KW": 30, "LB": 28, "LI": 21, "LT": 20,
    "LU": 20, "LV": 21, "MT": 31, "NL": 18, "NO": 15, "PK": 24, "PL": 28,
    "PT": 25, "QA": 29, "RO": 24, "SA": 24, "SE": 24, "SI": 19, "SK": 24,
    "TR": 26, "UA": 29,
}

_IBAN_SHAPE = re.compile(r"^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$")
_PK_IBAN_SHAPE = re.compile(r"^PK\d{2}[A-Z]{4}[A-Z0-9]{16}$")
_BIC = re.compile(r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$")


def iban_mod97_ok(iban: str) -> bool:
    """ISO 7064 mod-97-10 check on an already-normalized IBAN."""
    rearranged = iban[4:] + iban[:4]
    try:
        numeric = "".join(str(int(c, 36)) for c in rearranged)
    except ValueError:
        return False
    return int(numeric) % 97 == 1


def normalize_iban(value: str) -> str:
    return re.sub(r"[\s-]", "", value).upper()


def validate_iban(value: str, country: str | None = None) -> str:
    iban = normalize_iban(value)
    if not _IBAN_SHAPE.match(iban):
        raise ValueError("not a valid IBAN")
    expected = IBAN_LENGTHS.get(iban[:2])
    if expected is not None and len(iban) != expected:
        raise ValueError(f"an IBAN for {iban[:2]} must be {expected} characters")
    if not iban_mod97_ok(iban):
        raise ValueError("IBAN checksum is invalid")
    if country is not None and iban[:2] != country.upper():
        raise ValueError(f"IBAN country {iban[:2]} does not match {country.upper()}")
    return iban


def validate_pk_iban(value: str) -> str:
    iban = validate_iban(value)
    if not _PK_IBAN_SHAPE.match(iban):
        raise ValueError("a Pakistani IBAN is PK + 2 digits + 4-letter bank code + 16 characters")
    return iban


def validate_aba(value: str) -> str:
    routing = re.sub(r"[\s-]", "", value)
    if not re.fullmatch(r"\d{9}", routing):
        raise ValueError("routing number must be 9 digits")
    d = [int(c) for c in routing]
    checksum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
    if checksum % 10 != 0:
        raise ValueError("routing number checksum is invalid")
    return routing


def normalize_sort_code(value: str) -> str:
    code = value.strip()
    if re.fullmatch(r"\d{2}-\d{2}-\d{2}", code):
        code = code.replace("-", "")
    if not re.fullmatch(r"\d{6}", code):
        raise ValueError("sort code must be 6 digits (e.g. 12-34-56)")
    return code


def validate_swift_bic(value: str) -> str:
    bic = re.sub(r"\s", "", value).upper()
    if not _BIC.match(bic):
        raise ValueError("SWIFT/BIC must be 8 or 11 characters (e.g. SCBLPKKA)")
    return bic


def normalize_pk_mobile(value: str) -> str:
    digits = re.sub(r"[\s-]", "", value)
    m = re.fullmatch(r"(?:\+92|0092|92|0)(3\d{9})", digits)
    if not m:
        raise ValueError("not a Pakistani mobile number (e.g. 03001234567)")
    return f"+92{m.group(1)}"


def validate_https_url(value: str) -> str:
    url = value.strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("must be an https:// URL")
    return url
