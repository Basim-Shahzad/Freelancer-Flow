"""Pure money / time arithmetic for invoicing. No I/O, fully unit-testable."""

from __future__ import annotations

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
_HUNDRED = Decimal("100")
_SIXTY = Decimal("60")


def quantize_money(value: Decimal) -> Decimal:
    """Round to 2 decimal places, half-up (the convention invoices use)."""
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def duration_minutes(start: datetime, end: datetime) -> int:
    """Whole minutes between two datetimes, rounded to the nearest minute.

    Never negative: callers validate ordering, but a few seconds of clock skew
    on a just-stopped timer must not produce a negative duration.
    """
    seconds = (end - start).total_seconds()
    return max(int((seconds + 30) // 60), 0)


def hours_from_minutes(minutes: int) -> Decimal:
    return quantize_money(Decimal(minutes) / _SIXTY)


def time_entry_amount(minutes: int, hourly_rate: Decimal) -> Decimal:
    """Bill exact minutes (not the rounded hour figure) so totals cannot drift."""
    return quantize_money(Decimal(minutes) / _SIXTY * hourly_rate)


def line_amount(quantity: Decimal, unit_price: Decimal) -> Decimal:
    return quantize_money(quantity * unit_price)


def compute_totals(
    subtotal: Decimal, discount_rate: Decimal, tax_rate: Decimal
) -> tuple[Decimal, Decimal, Decimal]:
    """Return ``(discount_amount, tax_amount, total)``.

    The discount applies to the subtotal; tax applies to the discounted
    amount. Rates are percentages (15 == 15%).
    """
    discount_amount = quantize_money(subtotal * discount_rate / _HUNDRED)
    taxable = subtotal - discount_amount
    tax_amount = quantize_money(taxable * tax_rate / _HUNDRED)
    return discount_amount, tax_amount, taxable + tax_amount
