"""Reusable, validated field types shared by the request/response schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BeforeValidator, Field


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


UTCDateTime = Annotated[datetime, AfterValidator(_to_utc)]

# Money: NUMERIC(13, 2). `Money` allows zero, `PositiveMoney` does not.
Money = Annotated[Decimal, Field(ge=0, max_digits=13, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=13, decimal_places=2)]

# Percentage in [0, 100] with two decimals (15.00 == 15%).
Percent = Annotated[Decimal, Field(ge=0, le=100, max_digits=5, decimal_places=2)]

# ISO-4217 alphabetic code, normalised to upper case.
CurrencyCode = Annotated[
    str,
    BeforeValidator(_normalise_currency),
    Field(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3, examples=["SAR"]),
]
