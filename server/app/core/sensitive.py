"""Detection and protection of sensitive identifiers.

Paylancer never stores payment credentials or national ID numbers in free
text. The detectors below are deliberately narrow (checksums / exact formats)
so ordinary references and notes are not rejected by accident.

Tax identifiers we *do* store (they are printed on invoices) are encrypted at
rest with ``EncryptedText``.
"""

from __future__ import annotations

import base64
import hashlib
import re
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.bank_validators import iban_mod97_ok
from app.core.config import settings

# ── Detection ─────────────────────────────────────────────────────────────────

# 13-19 digits, optionally grouped with spaces or dashes ("4111 1111 ...").
_DIGIT_RUN = re.compile(r"(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)")
# ISO-13616 IBAN, optionally grouped in blocks of four.
_IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b")
# Pakistani CNIC as printed: 12345-1234567-1.
_CNIC = re.compile(r"(?<!\d)\d{5}-\d{7}-\d(?!\d)")


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def contains_card_number(text: str) -> bool:
    """A Luhn-valid 13-19 digit run starting like a card network (2-6)."""
    for match in _DIGIT_RUN.finditer(text):
        digits = re.sub(r"\D", "", match.group())
        if 13 <= len(digits) <= 19 and digits[0] in "23456" and _luhn_ok(digits):
            return True
    return False


def contains_iban(text: str) -> bool:
    """An IBAN that passes the mod-97 check."""
    for match in _IBAN.finditer(text.upper()):
        if iban_mod97_ok(match.group().replace(" ", "")):
            return True
    return False


def contains_cnic(text: str) -> bool:
    return bool(_CNIC.search(text))


def reject_card_and_cnic(value: Optional[str]) -> Optional[str]:
    """Validator for free text shown to clients (notes, payment instructions).

    Bank details (IBAN) are allowed here: a freelancer's own account is a
    legitimate payment instruction.
    """
    if value is None:
        return value
    if contains_card_number(value):
        raise ValueError("looks like a card number; Paylancer never stores card details")
    if contains_cnic(value):
        raise ValueError("looks like a CNIC number; do not include national ID numbers")
    return value


def reject_payment_details(value: Optional[str]) -> Optional[str]:
    """Validator for payment references: a transaction ID only."""
    value = reject_card_and_cnic(value)
    if value is not None and contains_iban(value):
        raise ValueError("looks like a bank account (IBAN); enter the transaction ID only")
    return value


def mask(value: Optional[str], visible: int = 4) -> Optional[str]:
    """``"1234567-8"`` -> ``"•••••67-8"``-style: keep only the last characters."""
    if not value:
        return value
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]


# ── Encryption at rest ────────────────────────────────────────────────────────


def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        # Development fallback only (production requires the setting).
        digest = hashlib.sha256(b"paylancer-field-encryption:" + settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


_FERNET = _fernet()


class EncryptedText(TypeDecorator):
    """A string column stored Fernet-encrypted.

    Values written before encryption was introduced are returned as-is and
    get encrypted the next time they are saved.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return _FERNET.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return _FERNET.decrypt(value.encode()).decode()
        except InvalidToken:
            return value
