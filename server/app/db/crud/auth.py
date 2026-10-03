"""
Users, refresh tokens and the session flows built on them (register, login,
refresh rotation, logout, password change). Routes only handle cookies.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jwt.exceptions import PyJWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequest, Conflict, Forbidden, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.User import User, UserRole
from app.models.RefreshToken import RefreshToken
from app.models.FreelancerProfile import FreelancerProfile
from app.schemas.AuthSchema import UserCreate

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(
        select(User)
        .options(selectinload(User.freelancer))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()



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

    freelancer_profile = FreelancerProfile(user_id=user.id)

    db.add(freelancer_profile)

    await db.commit()
    await db.refresh(user)
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


# ---------------------------------------------------------------------------
# Session flows
# ---------------------------------------------------------------------------


def _email_taken() -> Conflict:
    return Conflict("An account with this email already exists")


async def register_user(db: AsyncSession, payload: UserCreate) -> User:
    if await get_user_by_email(db, payload.email):
        raise _email_taken()
    try:
        return await create_user(db, payload)
    except IntegrityError:
        await db.rollback()
        raise _email_taken()


async def _issue_tokens(
    db: AsyncSession,
    user_id: UUID,
    user_agent: str | None,
    ip_address: str | None,
) -> tuple[str, str]:
    """New access + refresh pair; the refresh token is persisted (no commit)
    so it can be individually revoked."""
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    await create_refresh_token_record(
        db,
        user_id=user_id,
        token=refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return access_token, refresh_token


async def login(
    db: AsyncSession,
    email: str,
    password: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    """Returns ``(access_token, refresh_token)``."""
    user = await get_user_by_email(db, email)

    # Constant-time comparison to avoid timing attacks
    if not user or not verify_password(password, user.hashed_password):
        raise Unauthorized("Invalid email or password")

    if not user.is_active:
        raise Forbidden("Account is disabled")

    tokens = await _issue_tokens(db, user.id, user_agent, ip_address)
    await update_last_login(db, user)
    await db.commit()
    return tokens


async def rotate_refresh_token(
    db: AsyncSession,
    refresh_token: str | None,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, str]:
    """Exchange a refresh token for a new ``(access_token, refresh_token)``."""
    # 1. Token present
    if not refresh_token:
        raise Unauthorized("Refresh token missing")

    # 2. Validate JWT signature + expiry
    try:
        token_data = decode_token(refresh_token)
    except PyJWTError:
        raise Unauthorized("Refresh token is invalid or expired")

    if token_data.get("type") != "refresh":
        raise Unauthorized("Invalid token type")

    # 3. Validate DB record (allows manual revocation)
    record = await get_refresh_token_record(db, refresh_token)
    if not record or not record.is_valid:
        raise Unauthorized("Refresh token has been revoked or expired")

    # 4. Rotate: revoke the used refresh token and issue a new one. This
    # limits the damage of a stolen refresh token to a single use and lets
    # future work detect reuse of a revoked token as a theft signal.
    await revoke_refresh_token(db, record)
    tokens = await _issue_tokens(db, record.user_id, user_agent, ip_address)
    await db.commit()
    return tokens


async def logout(db: AsyncSession, refresh_token: str | None) -> None:
    """Revoke one refresh token, if it is still valid."""
    if refresh_token:
        record = await get_refresh_token_record(db, refresh_token)
        if record and record.is_valid:
            await revoke_refresh_token(db, record)
            await db.commit()


async def logout_everywhere(db: AsyncSession, user_id: UUID) -> int:
    count = await revoke_all_user_tokens(db, user_id)
    await db.commit()
    return count


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise BadRequest("Current password is incorrect")

    await change_user_password(db, user, new_password)
    # Security: invalidate all existing sessions after password change
    await revoke_all_user_tokens(db, user.id)
    await db.commit()
