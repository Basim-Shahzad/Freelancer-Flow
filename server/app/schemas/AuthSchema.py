from datetime import datetime
from uuid import UUID

from pydantic import ConfigDict, EmailStr, Field, field_validator
from .Base import Base

# ---------------------------------------------------------------------------
# User schemas
# ---------------------------------------------------------------------------


class UserBase(Base):
    email: EmailStr
    full_name: str | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(Base):
    full_name: str | None = None
    email: EmailStr | None = None


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login_at: datetime | None


class UserPublic(Base):
    """Minimal public-safe user info (e.g. for embedding in tokens or lists)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str | None
    role: str


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------


class LoginRequest(Base):
    email: EmailStr
    password: str


class TokenPair(Base):
    """Returned on login and token refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(Base):
    refresh_token: str


class AccessTokenResponse(Base):
    access_token: str


class ChangePasswordRequest(Base):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class MessageResponse(Base):
    message: str
