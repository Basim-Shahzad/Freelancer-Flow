"""Reusable, validated field types shared by the request/response schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field

from app.core.currencies import MAX_EXPONENT, is_valid_currency


def _to_utc(value: datetime) -> datetime:
    """Naive datetimes are assumed to be UTC; aware ones are converted to UTC.

    Prevents "can't compare offset-naive and offset-aware datetimes" errors
    downstream and keeps stored values consistent.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalise_currency(value: object) -> object:
    return value.strip().upper() if isinstance(value, str) else value


def _check_currency(value: str) -> str:
    if not is_valid_currency(value):
        raise ValueError(f"{value} is not a recognised ISO-4217 currency code")
    return value


UTCDateTime = Annotated[datetime, AfterValidator(_to_utc)]

# Money: NUMERIC(18, 4) so every ISO-4217 exponent (0-4) fits; amounts are
# rounded to the currency's own exponent in the service layer.
# `Money` allows zero, `PositiveMoney` does not.
Money = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=MAX_EXPONENT)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=MAX_EXPONENT)]

# Percentage in [0, 100] with two decimals (15.00 == 15%).
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]

# ISO-4217 alphabetic code, normalised to upper case.
CurrencyCode = Annotated[
    str,
    BeforeValidator(_normalise_currency),
    AfterValidator(_check_currency),
    Field(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3, examples=["USD"]),
]
