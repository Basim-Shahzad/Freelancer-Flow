"""Pure money / time arithmetic for invoicing. No I/O, fully unit-testable.

Nothing here knows about a country: rounding follows the currency's ISO-4217
minor unit and taxes are an arbitrary list of user-defined rates.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_EVEN, ROUND_HALF_UP, Decimal
from typing import Iterable, Optional

from app.core.currencies import currency_exponent

_HUNDRED = Decimal("100")
_SIXTY = Decimal("60")


def quantize_money(
    value: Decimal, currency: Optional[str] = None, *, rounding: str = ROUND_HALF_UP
) -> Decimal:
    """Round to the currency's minor unit (JPY 0, USD 2, KWD 3...), half-up."""
    return value.quantize(Decimal(1).scaleb(-currency_exponent(currency)), rounding=rounding)


def duration_minutes(start: datetime, end: datetime) -> int:
    """Whole minutes between two datetimes, rounded to the nearest minute.

    Never negative: callers validate ordering, but a few seconds of clock skew
    on a just-stopped timer must not produce a negative duration.
    """
    seconds = (end - start).total_seconds()
    return max(int((seconds + 30) // 60), 0)


def hours_from_minutes(minutes: int) -> Decimal:
    """Hours as a 2-dp quantity (a time unit, not money)."""
    return (Decimal(minutes) / _SIXTY).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def time_entry_amount(
    minutes: int, hourly_rate: Decimal, currency: Optional[str] = None
) -> Decimal:
    """Bill exact minutes (not the rounded hour figure) so totals cannot drift."""
    return quantize_money(Decimal(minutes) / _SIXTY * hourly_rate, currency)


def line_amount(
    quantity: Decimal, unit_price: Decimal, currency: Optional[str] = None
) -> Decimal:
    return quantize_money(quantity * unit_price, currency)


@dataclass(frozen=True)
class TaxSpec:
    """A tax to apply, as configured by the user (any name, any regime).

    ``is_inclusive``: prices already contain this tax (it is extracted, not
    added). ``is_compound``: computed on the base *plus* earlier exclusive taxes.
    ``is_withholding``: deducted from what the client pays (not tax collected).
    """

    name: str
    rate: Decimal
    is_inclusive: bool = False
    is_compound: bool = False
    is_withholding: bool = False


@dataclass(frozen=True)
class TaxLine:
    name: str
    rate: Decimal
    amount: Decimal
    is_inclusive: bool
    is_compound: bool
    is_withholding: bool


@dataclass(frozen=True)
class Totals:
    discount_amount: Decimal
    tax_lines: list[TaxLine]
    tax_amount: Decimal  # collected taxes only (withholding excluded)
    withholding_amount: Decimal
    total: Decimal  # amount the client owes


def compute_totals(
    subtotal: Decimal,
    discount_rate: Decimal,
    taxes: Iterable[TaxSpec] = (),
    currency: Optional[str] = None,
    *,
    rounding: str = ROUND_HALF_UP,
) -> Totals:
    """Discount first, then taxes on the discounted amount.

    Inclusive taxes are extracted from the discounted amount (it already
    contains them); exclusive taxes are added on the net; compound ones stack
    on the net plus earlier exclusive taxes. Withholding is subtracted.
    Rates are percentages (15 == 15%).
    """
    taxes = list(taxes)

    def q(value: Decimal) -> Decimal:
        return quantize_money(value, currency, rounding=rounding)

    discount_amount = q(subtotal * discount_rate / _HUNDRED)
    discounted = subtotal - discount_amount

    inclusive_rate = sum((t.rate for t in taxes if t.is_inclusive), Decimal("0"))
    net = discounted / (1 + inclusive_rate / _HUNDRED) if inclusive_rate else discounted

    lines: list[TaxLine] = []
    running_exclusive = Decimal("0")
    for t in taxes:
        if t.is_inclusive:
            base = net
        elif t.is_compound:
            base = net + running_exclusive
        else:
            base = net
        amount = q(base * t.rate / _HUNDRED)
        if not t.is_inclusive:
            running_exclusive += amount
        lines.append(
            TaxLine(t.name, t.rate, amount, t.is_inclusive, t.is_compound, t.is_withholding)
        )

    tax_amount = sum((l.amount for l in lines if not l.is_withholding), Decimal("0"))
    withholding = sum((l.amount for l in lines if l.is_withholding), Decimal("0"))
    inclusive_collected = sum(
        (l.amount for l in lines if l.is_inclusive and not l.is_withholding), Decimal("0")
    )
    exclusive_collected = tax_amount - inclusive_collected
    # Inclusive tax is already inside `discounted`; only exclusive tax adds on.
    total = discounted + exclusive_collected - withholding
    return Totals(discount_amount, lines, tax_amount, withholding, total)


__all__ = [
    "ROUND_HALF_EVEN",
    "ROUND_HALF_UP",
    "TaxLine",
    "TaxSpec",
    "Totals",
    "compute_totals",
    "duration_minutes",
    "hours_from_minutes",
    "line_amount",
    "quantize_money",
    "time_entry_amount",
]
