"""Unit tests for the pure invoicing arithmetic (no database)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.invoicing import (
    TaxSpec,
    compute_totals,
    duration_minutes,
    hours_from_minutes,
    line_amount,
    quantize_money,
    time_entry_amount,
)

T0 = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)


def _tax(rate, **kw):
    return TaxSpec(kw.pop("name", "Tax"), Decimal(rate), **kw)


def test_totals_apply_discount_before_tax():
    t = compute_totals(Decimal("1000"), Decimal("10"), [_tax("15")], "USD")
    assert (t.discount_amount, t.tax_amount, t.total) == (
        Decimal("100.00"), Decimal("135.00"), Decimal("1035.00"),
    )


def test_totals_round_half_up_to_currency_minor_unit():
    t = compute_totals(Decimal("33.33"), Decimal("0"), [_tax("15")], "USD")
    assert t.tax_amount == Decimal("5.00")  # 4.9995 -> 5.00
    assert t.total == Decimal("38.33")


def test_no_taxes():
    t = compute_totals(Decimal("50"), Decimal("0"))
    assert (t.discount_amount, t.tax_amount, t.total) == (
        Decimal("0.00"), Decimal("0"), Decimal("50"),
    )


def test_rounding_follows_currency_exponent():
    assert quantize_money(Decimal("1234.5"), "JPY") == Decimal("1235")
    assert quantize_money(Decimal("1.2345"), "KWD") == Decimal("1.235")
    assert quantize_money(Decimal("1.2345"), "USD") == Decimal("1.23")
    t = compute_totals(Decimal("1000"), Decimal("0"), [_tax("10")], "JPY")
    assert t.tax_amount == Decimal("100") and t.total == Decimal("1100")


def test_multiple_and_compound_taxes():
    t = compute_totals(
        Decimal("100"), Decimal("0"),
        [_tax("5", name="GST"), _tax("10", name="PST", is_compound=True)], "USD",
    )
    # 5.00 on 100, then 10% on 105.
    assert [l.amount for l in t.tax_lines] == [Decimal("5.00"), Decimal("10.50")]
    assert t.total == Decimal("115.50")


def test_inclusive_tax_is_extracted_not_added():
    t = compute_totals(Decimal("115"), Decimal("0"), [_tax("15", is_inclusive=True)], "USD")
    assert t.tax_amount == Decimal("15.00")
    assert t.total == Decimal("115")


def test_withholding_reduces_amount_due_and_is_not_collected_tax():
    t = compute_totals(
        Decimal("1000"), Decimal("0"),
        [_tax("10", name="VAT"), _tax("5", name="WHT", is_withholding=True)], "USD",
    )
    assert t.tax_amount == Decimal("100.00")
    assert t.withholding_amount == Decimal("50.00")
    assert t.total == Decimal("1050.00")



def test_compound_tax_ignores_earlier_withholding():
    t = compute_totals(
        Decimal("1000"), Decimal("0"),
        [
            _tax("10", name="VAT"),
            _tax("5", name="WHT", is_withholding=True),
            _tax("10", name="PST", is_compound=True),
        ],
        "USD",
    )
    # PST is 10% of 1000 + VAT 100, not of 1000 + VAT + WHT.
    assert [l.amount for l in t.tax_lines] == [
        Decimal("100.00"), Decimal("50.00"), Decimal("110.00"),
    ]
    assert t.tax_amount == Decimal("210.00")
    assert t.total == Decimal("1160.00")

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
