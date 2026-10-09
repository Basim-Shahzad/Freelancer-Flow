"""Pure phone-number helpers for WhatsApp sharing."""

import re
from typing import Optional

_STRIP = re.compile(r"[\s\-().]")
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_PK_LOCAL = re.compile(r"^03\d{9}$")


def normalize_whatsapp(raw: Optional[str]) -> Optional[str]:
    """Return an E.164 number, or None for empty input; raise ValueError if invalid.

    Pakistani local numbers (03XXXXXXXXX) become +923XXXXXXXXX; 00-prefixed
    international numbers become +; other input must already be E.164.
    """
    if raw is None:
        return None
    value = _STRIP.sub("", raw)
    if not value:
        return None
    if _PK_LOCAL.match(value):
        value = "+92" + value[1:]
    elif value.startswith("00"):
        value = "+" + value[2:]
    if not _E164.match(value):
        raise ValueError("Enter a valid WhatsApp number, e.g. 03001234567 or +14155550123")
    return value


def wa_digits(e164: str) -> str:
    """Digits-only form used in wa.me links."""
    return e164.lstrip("+")
