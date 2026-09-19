"""Unit tests for the pure invoicing arithmetic (no database)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.invoicing import (
    compute_totals,
    duration_minutes,
    hours_from_minutes,
    line_amount,
    time_entry_amount,
)

T0 = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)


def test_totals_apply_discount_before_tax():
    discount, tax, total = compute_totals(Decimal("1000"), Decimal("10"), Decimal("15"))
    assert (discount, tax, total) == (Decimal("100.00"), Decimal("135.00"), Decimal("1035.00"))


def test_totals_round_half_up_to_cents():
    discount, tax, total = compute_totals(Decimal("33.33"), Decimal("0"), Decimal("15"))
    assert tax == Decimal("5.00")  # 4.9995 -> 5.00
    assert total == Decimal("38.33")


def test_zero_rates():
    assert compute_totals(Decimal("50"), Decimal("0"), Decimal("0")) == (
        Decimal("0.00"), Decimal("0.00"), Decimal("50"),
    )


def test_duration_rounds_to_nearest_minute_and_never_goes_negative():
    assert duration_minutes(T0, T0 + timedelta(minutes=90)) == 90
    assert duration_minutes(T0, T0 + timedelta(seconds=89)) == 1
    assert duration_minutes(T0, T0 + timedelta(seconds=29)) == 0
    assert duration_minutes(T0, T0 - timedelta(minutes=5)) == 0


def test_time_entry_amount_bills_exact_minutes():
    # 50 minutes at 100/h = 83.33, whereas billing the rounded 0.83h would give 83.00.
    assert hours_from_minutes(50) == Decimal("0.83")
    assert time_entry_amount(50, Decimal("100")) == Decimal("83.33")


def test_line_amount():
    assert line_amount(Decimal("2.5"), Decimal("19.99")) == Decimal("49.98")
