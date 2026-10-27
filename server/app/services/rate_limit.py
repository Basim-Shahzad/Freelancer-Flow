"""DB-backed fixed-window rate limiter.

Counters live in ``rate_limit_counters`` so limits hold across workers and
restarts. ``check_rate_limit`` commits on its own: the attempt must stay
counted even when the caller goes on to fail the request.
"""

from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import RateLimited
from app.models.RateLimitCounter import RateLimitCounter

GLOBAL_PRUNE_PROBABILITY = 0.01
GLOBAL_PRUNE_AGE = timedelta(days=1)


def _window_start(now: datetime, window_seconds: int) -> datetime:
    epoch = int(now.timestamp())
    return datetime.fromtimestamp(epoch - epoch % window_seconds, tz=UTC)


async def _bump(db: AsyncSession, key: str, window_start: datetime) -> bool:
    result = await db.execute(
        update(RateLimitCounter)
        .where(
            RateLimitCounter.key == key,
            RateLimitCounter.window_start == window_start,
        )
        .values(count=RateLimitCounter.count + 1)
    )
    return result.rowcount > 0


async def check_rate_limit(
    db: AsyncSession,
    key: str,
    *,
    limit: int,
    window_seconds: int,
    now: datetime | None = None,
) -> None:
    """Count one attempt for ``key``; raise ``RateLimited`` past ``limit``."""
    now = now or datetime.now(UTC)
    start = _window_start(now, window_seconds)

    if not await _bump(db, key, start):
        try:
            async with db.begin_nested():
                db.add(RateLimitCounter(key=key, window_start=start, count=1))
        except IntegrityError:
            # Lost the race to create the row; it exists now.
            await _bump(db, key, start)

    count = (
        await db.execute(
            select(RateLimitCounter.count).where(
                RateLimitCounter.key == key,
                RateLimitCounter.window_start == start,
            )
        )
    ).scalar_one()

    # Opportunistic pruning of this key's expired windows.
    await db.execute(
        delete(RateLimitCounter).where(
            RateLimitCounter.key == key, RateLimitCounter.window_start < start
        )
    )
    # Keys that are never seen again would otherwise linger forever.
    if random.random() < GLOBAL_PRUNE_PROBABILITY:  # nosec B311 - pruning jitter, not security
        await db.execute(
            delete(RateLimitCounter).where(
                RateLimitCounter.window_start < now - GLOBAL_PRUNE_AGE
            )
        )
    await db.commit()

    if count > limit:
        retry_in = max(
            int((start + timedelta(seconds=window_seconds) - now).total_seconds()), 1
        )
        raise RateLimited(
            f"Too many attempts. Try again in {retry_in} seconds.", retry_after=retry_in
        )
