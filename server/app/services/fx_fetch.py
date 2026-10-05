"""Automatic exchange-rate refresh for the ``exchange_rates`` reference setting.

Money Rule: rates are display-only reference data. They are never used in
totals and never stored on invoices or payments.

``get_exchange_rates`` is the only reader the rest of the app should use.
"""

from __future__ import annotations

import asyncio
import logging
import weakref
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequest
from app.db.crud import reference as reference_crud
from app.models.User import User

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(5.0)


class FxFetchError(Exception):
    pass


# One lock per event loop: only one fetch runs at a time within a process.
_locks: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Lock]" = (
    weakref.WeakKeyDictionary()
)


def _fetch_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = _locks.get(loop)
    if lock is None:
        lock = _locks[loop] = asyncio.Lock()
    return lock


async def fetch_rates(client: Optional[httpx.AsyncClient] = None) -> dict[str, Any]:
    """Fetch rates once (no retries) and return a full ``exchange_rates`` value.

    Raises ``FxFetchError`` on any network, HTTP or payload problem.
    """
    try:
        if client is None:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as own:
                response = await own.get(settings.FX_API_URL)
        else:
            response = await client.get(settings.FX_API_URL)
        response.raise_for_status()
        payload = response.json()

        if payload.get("result") != "success":
            raise ValueError("provider did not report success")
        provider_rates = payload["rates"]
        as_of = datetime.fromtimestamp(
            int(payload["time_last_update_unix"]), tz=timezone.utc
        ).date()

        rates: dict[str, str] = {}
        for code in settings.fx_currencies_list:
            raw = provider_rates.get(code)
            if raw is None:
                continue
            rate = Decimal(str(raw))
            if not rate.is_finite() or rate <= 0:
                raise ValueError(f"invalid rate for {code}")
            rates[code] = str(rate)
        if not rates:
            raise ValueError("no configured currencies in response")
    except (httpx.HTTPError, ValueError, KeyError, TypeError, InvalidOperation) as exc:
        raise FxFetchError(str(exc) or exc.__class__.__name__) from exc

    return {
        "base": str(payload.get("base_code") or "USD").upper(),
        "rates": rates,
        "as_of": as_of.isoformat(),
        "source": urlparse(settings.FX_API_URL).hostname,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "manual_override": False,
    }


def _is_fresh(value: dict[str, Any]) -> bool:
    fetched_at = value.get("fetched_at")
    if not fetched_at or not value.get("rates"):
        return False
    try:
        fetched = datetime.fromisoformat(fetched_at)
    except ValueError:
        return False
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - fetched
    return age < timedelta(hours=settings.FX_MAX_AGE_HOURS)


async def _store(db: AsyncSession, value: dict[str, Any], user: Optional[User]) -> dict:
    as_of = value.get("as_of")
    setting = await reference_crud.set_setting(
        db,
        reference_crud.EXCHANGE_RATES,
        value,
        reference_date=date.fromisoformat(as_of) if as_of else None,
        user=user,
    )
    return setting.value


async def get_exchange_rates(
    db: AsyncSession, client: Optional[httpx.AsyncClient] = None
) -> dict[str, Any]:
    """Cached rates, refreshed when stale. Never raises into the request."""
    setting = await reference_crud.find_setting(db, reference_crud.EXCHANGE_RATES)
    cached = setting.value if setting else dict(reference_crud.DEFAULTS["exchange_rates"])

    if setting is None or not settings.FX_AUTO_FETCH:
        return cached
    if cached.get("manual_override") or _is_fresh(cached):
        return cached

    async with _fetch_lock():
        # Another request may have refreshed while we waited for the lock.
        await db.refresh(setting)
        cached = setting.value
        if cached.get("manual_override") or _is_fresh(cached):
            return cached
        try:
            return await _store(db, await fetch_rates(client), None)
        except FxFetchError as exc:
            logger.warning("Exchange-rate refresh failed, serving cached rates: %s", exc)
        except Exception:
            logger.warning("Exchange-rate refresh failed unexpectedly", exc_info=True)
        await db.rollback()
        await db.refresh(setting)
        return setting.value


async def refresh_now(
    db: AsyncSession, user: User, client: Optional[httpx.AsyncClient] = None
) -> dict[str, Any]:
    """Admin-forced fetch. Clears any manual override; failures are surfaced."""
    async with _fetch_lock():
        try:
            value = await fetch_rates(client)
        except FxFetchError as exc:
            raise BadRequest(f"Could not fetch exchange rates: {exc}")
        return await _store(db, value, user)
