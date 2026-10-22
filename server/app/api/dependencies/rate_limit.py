"""Request-side helpers for the DB-backed limiter: who is calling, and which
counters an endpoint charges."""

from __future__ import annotations

import hashlib

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.services.rate_limit import check_rate_limit


def client_ip(request: Request) -> str | None:
    """Caller IP. Forwarding headers are read only when ``TRUSTED_PROXY_HEADER``
    names one, since otherwise any client could spoof its way past the limits."""
    header = settings.TRUSTED_PROXY_HEADER.strip()
    if header:
        value = request.headers.get(header)
        if value:
            # Proxies append, so the first entry is the original client.
            first = value.split(",")[0].strip()
            if first:
                return first
    return request.client.host if request.client else None


def _email_key(email: str) -> str:
    # Hashed so the counter table holds no addresses.
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]


async def enforce_auth_limits(
    db: AsyncSession, request: Request, scope: str, email: str
) -> None:
    """Charge one ``scope`` attempt (login, register) to the IP and to the email."""
    window = settings.AUTH_RATE_WINDOW_SECONDS
    await check_rate_limit(
        db,
        f"{scope}:ip:{client_ip(request) or 'unknown'}",
        limit=settings.AUTH_RATE_LIMIT_PER_IP,
        window_seconds=window,
    )
    await check_rate_limit(
        db,
        f"{scope}:email:{_email_key(email)}",
        limit=settings.AUTH_RATE_LIMIT_PER_EMAIL,
        window_seconds=window,
    )


async def portal_rate_limit(request: Request, db: AsyncSession = Depends(get_db)) -> None:
    """Router-level dependency for the token-based portal endpoints."""
    await check_rate_limit(
        db,
        f"portal:ip:{client_ip(request) or 'unknown'}",
        limit=settings.PORTAL_RATE_LIMIT,
        window_seconds=settings.PORTAL_RATE_WINDOW_SECONDS,
    )
