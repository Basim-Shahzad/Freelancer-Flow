"""DB-backed fixed-window limiter."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.errors import RateLimited
from app.models.RateLimitCounter import RateLimitCounter
from app.services.rate_limit import check_rate_limit

NOW = datetime(2026, 3, 1, 12, 0, 30, tzinfo=timezone.utc)


async def test_blocks_after_limit_and_is_per_key(db_session):
    for _ in range(2):
        await check_rate_limit(db_session, "k", limit=2, window_seconds=60, now=NOW)
    with pytest.raises(RateLimited):
        await check_rate_limit(db_session, "k", limit=2, window_seconds=60, now=NOW)
    await check_rate_limit(db_session, "other", limit=2, window_seconds=60, now=NOW)


async def test_window_resets_and_old_rows_are_pruned(db_session):
    for _ in range(3):
        try:
            await check_rate_limit(db_session, "k", limit=2, window_seconds=60, now=NOW)
        except RateLimited:
            pass
    later = NOW + timedelta(seconds=61)
    await check_rate_limit(db_session, "k", limit=2, window_seconds=60, now=later)
    rows = (await db_session.execute(select(RateLimitCounter))).scalars().all()
    assert len(rows) == 1 and rows[0].count == 1
