"""Pure time-entry rules shared by logging, bulk edit and offline sync."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

# Tolerated client clock skew when validating "not in the future".
FUTURE_TOLERANCE = timedelta(minutes=5)
MAX_DURATION = timedelta(hours=24)


def aware(value: datetime) -> datetime:
    """SQLite (tests) returns naive datetimes; Postgres returns aware ones."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def validate_window(
    start: datetime, end: datetime | None, now: datetime
) -> str | None:
    """Reason the time window is invalid, or ``None``. ``end=None`` is a running timer."""
    start = aware(start)
    if start > now + FUTURE_TOLERANCE:
        return "start_time cannot be in the future"
    if end is None:
        return None
    end = aware(end)
    if end <= start:
        return "end_time must be after start_time"
    if end > now + FUTURE_TOLERANCE:
        return "end_time cannot be in the future"
    if end - start > MAX_DURATION:
        return "duration cannot exceed 24 hours"
    return None


def overlaps(
    start: datetime,
    end: datetime | None,
    other_start: datetime,
    other_end: datetime | None,
    now: datetime,
) -> bool:
    """Half-open interval overlap; a running entry extends to ``now``.

    Entries that merely touch (one ends exactly when the next starts) do not overlap.
    """
    a_start, b_start = aware(start), aware(other_start)
    a_end = aware(end) if end is not None else max(now, a_start)
    b_end = aware(other_end) if other_end is not None else max(now, b_start)
    return a_start < b_end and b_start < a_end
