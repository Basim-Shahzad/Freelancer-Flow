"""Local-calendar windows converted to UTC bounds (pure, no I/O)."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def local_window(
    period_start: date, period_end: date, tz_name: str
) -> tuple[datetime, datetime]:
    """UTC ``[start, end)`` covering the local dates ``period_start`` through
    ``period_end`` inclusive in ``tz_name``."""
    tz = ZoneInfo(tz_name)
    return (
        datetime.combine(period_start, time.min, tzinfo=tz).astimezone(UTC),
        datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=tz).astimezone(
            UTC
        ),
    )
