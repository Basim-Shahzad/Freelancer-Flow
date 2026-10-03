from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.PortalAccessToken import PortalAccessToken, ScopeType


async def issue_portal_token(
    db: AsyncSession,
    client_id: uuid.UUID,
    scope_type: ScopeType,
    scope_id: uuid.UUID,
) -> str:
    """Stage a portal token row (flush, no commit) and return the signed JWT.

    The caller commits it atomically together with its own changes.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.PORTAL_TOKEN_EXPIRE_DAYS)
    jti = str(uuid.uuid4())

    db.add(
        PortalAccessToken(
            jti=jti,
            client_id=client_id,
            scope_type=scope_type,
            scope=scope_id,
            issued_at=now,
            expires_at=expires_at,
        )
    )
    await db.flush()

    payload = {
        "client_id": str(client_id),
        "jti": jti,
        "scope_type": (
            scope_type.value if isinstance(scope_type, ScopeType) else scope_type
        ),
        "scope": str(scope_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def validate_portal_token(db: AsyncSession, token_string: str) -> PortalAccessToken:
    try:
        payload = jwt.decode(
            token_string, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token signature",
        )

    jti: Optional[str] = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing JTI claim"
        )

    stmt = select(PortalAccessToken).where(PortalAccessToken.jti == jti)
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token record not found"
        )

    if token_record.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    now = datetime.now(timezone.utc)
    if token_record.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        )

    await _touch_last_used(db, token_record, now)
    return token_record


async def _touch_last_used(
    db: AsyncSession, token_record: PortalAccessToken, now: datetime
) -> None:
    """Record that the link was used (throttled to limit write volume)."""
    last = token_record.last_used_at
    if last is not None:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if (now - last).total_seconds() < settings.PORTAL_TOKEN_TOUCH_INTERVAL_SECONDS:
            return
    token_record.last_used_at = now
    await db.commit()
