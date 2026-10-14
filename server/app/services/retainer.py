"""Retainer billing periods (pure date math, no I/O).

Periods are anchored to ``retainer_start_date``: the nth period starts n
intervals after it, always counted from the *original* day, so a start on the
31st clamps to the last day of shorter months without drifting later periods.
Billing is in advance: the period containing today is billable now, future
periods are not.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Optional

from app.models.Expense import RecurrenceInterval

_MONTHS = {
    RecurrenceInterval.MONTHLY: 1,
    RecurrenceInterval.QUARTERLY: 3,
}

_MONTH_ABBR = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)  # fmt: skip


def _months(interval: RecurrenceInterval) -> int:
    try:
        return _MONTHS[interval]
    except KeyError:
        raise ValueError(f"Unsupported retainer interval: {interval}") from None


def _add_months(anchor: date, months: int) -> date:
    index = anchor.year * 12 + (anchor.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(anchor.day, calendar.monthrange(year, month)[1]))


def period_starts(
    start: date,
    interval: RecurrenceInterval,
    through: date,
    end_date: Optional[date] = None,
) -> list[date]:
    """Every period start from ``start`` up to ``through`` (inclusive), and no
    later than ``end_date`` when the retainer has one."""
    step = _months(interval)
    last = through if end_date is None else min(through, end_date)
    starts: list[date] = []
    n = 0
    while True:
        current = _add_months(start, n * step)
        if current > last:
            return starts
        starts.append(current)
        n += 1


def period_end(start: date, anchor: date, interval: RecurrenceInterval) -> date:
    """Last day of the period beginning at ``start`` (``anchor`` is the
    retainer's original start date, needed to find the next period start)."""
    step = _months(interval)
    n = _periods_between(anchor, start, step)
    return _add_months(anchor, (n + 1) * step) - timedelta(days=1)


def _periods_between(anchor: date, start: date, step: int) -> int:
    months = (start.year - anchor.year) * 12 + (start.month - anchor.month)
    return months // step


def period_label(start: date, interval: RecurrenceInterval) -> str:
    """Deterministic label: "Oct 2026" (monthly) or "Q4 2026" (quarterly,
    calendar quarter of the start date)."""
    if _months(interval) == 3:
        return f"Q{(start.month - 1) // 3 + 1} {start.year}"
    return f"{_MONTH_ABBR[start.month - 1]} {start.year}"
