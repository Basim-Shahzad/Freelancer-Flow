"""
Pure data-access functions. No FastAPI imports — these are plain functions
that take an AsyncSession and return ORM objects or None.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.models.User import User, UserRole
from app.models.RefreshToken import RefreshToken
from app.schemas.AuthSchema import UserCreate

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(User.email == email.lower())
    return await db.scalar(stmt)


async def create_user(
    db: AsyncSession,
    payload: UserCreate,
    role: UserRole = UserRole.USER,
    is_verified: bool = False,
) -> User:
    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=role,
        is_verified=is_verified,
    )
    db.add(user)
    await db.flush()
    return user


async def update_last_login(db: AsyncSession, user: User) -> None:
    user.last_login_at = datetime.now(timezone.utc)
    await db.flush()


async def set_user_active(db: AsyncSession, user: User, active: bool) -> User:
    user.is_active = active
    await db.flush()
    return user


async def change_user_password(db: AsyncSession, user: User, new_password: str) -> User:
    user.hashed_password = hash_password(new_password)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------


async def create_refresh_token_record(
    db: AsyncSession,
    *,
    user_id: UUID,
    token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> RefreshToken:
    record = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(record)
    await db.flush()
    return record


async def get_refresh_token_record(db: AsyncSession, token: str) -> RefreshToken | None:
    stmt = select(RefreshToken).where(RefreshToken.token == token)
    return await db.scalar(stmt)


async def revoke_refresh_token(db: AsyncSession, record: RefreshToken) -> None:
    record.revoked = True
    record.revoked_at = datetime.now(timezone.utc)
    await db.flush()


async def revoke_all_user_tokens(db: AsyncSession, user_id: UUID) -> int:
    stmt = select(RefreshToken).where(
        RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False)
    )
    result = await db.scalars(stmt)
    tokens = result.all()
    now = datetime.now(timezone.utc)
    for t in tokens:
        t.revoked = True
        t.revoked_at = now
    await db.flush()
    return len(tokens)
