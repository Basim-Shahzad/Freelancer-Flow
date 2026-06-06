"""
FastAPI dependency functions.

Usage:
    current_user  → any authenticated user (active)
    verified_user → authenticated + email verified
    admin_user    → authenticated + admin role
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.security import decode_token
from app.models.User import User, UserRole

from app.utils.crud.auth import get_user_by_id

# Re-usable bearer extractor (auto_error=False so we can give nicer messages)
_bearer = HTTPBearer(auto_error=False)


async def _extract_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User:
    """Core extraction logic shared by all auth dependencies."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token"
        )

    user = await get_user_by_id(db, UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled"
        )

    return user


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return await _extract_user(credentials, db)


def get_verified_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified",
        )
    return user


def get_admin_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


def get_moderator_or_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role not in (UserRole.MODERATOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user


# ---------------------------------------------------------------------------
# Typed aliases (cleaner endpoint signatures)
# ---------------------------------------------------------------------------

CurrentUser = Annotated[User, Depends(get_current_user)]
VerifiedUser = Annotated[User, Depends(get_verified_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
ModeratorUser = Annotated[User, Depends(get_moderator_or_admin)]
DBSession = Annotated[Session, Depends(get_db)]
