from fastapi import APIRouter, HTTPException, Request, status, Cookie, Response
from sqlalchemy.exc import IntegrityError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.utils.dependencies.auth import CurrentUser, DBSession
from app.schemas.AuthSchema import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    TokenPair,
    UserCreate,
    UserResponse,
    AccessTokenResponse,
)
from app.utils.crud.auth import (
    change_user_password,
    create_refresh_token_record,
    create_user,
    get_refresh_token_record,
    get_user_by_email,
    revoke_all_user_tokens,
    revoke_refresh_token,
    update_last_login,
)
from jose import JWTError

router = APIRouter()

# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account",
)
async def register(payload: UserCreate, db: DBSession):
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    try:
        user = await create_user(db, payload)
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=TokenPair,
    summary="Authenticate and receive access + refresh tokens",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: DBSession,
    response: Response,
):
    user = await get_user_by_email(db, payload.email)

    # Constant-time comparison to avoid timing attacks
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Persist the refresh token so it can be individually revoked
    user_agent = request.headers.get("user-agent")
    ip_address = request.client.host if request.client else None

    await create_refresh_token_record(
        db,
        user_id=user.id,
        token=refresh_token,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    await update_last_login(db, user)
    await db.commit()

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=604800,
    )

    return TokenPair(access_token=access_token, refresh_token="")


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,  # only returns access token now
    summary="Exchange a valid refresh token cookie for a new access token",
)
async def refresh_tokens(
    request: Request, db: DBSession, refresh_token: str = Cookie(None)
):
    # 1. Cookie present
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    # 2. Validate JWT signature + expiry
    try:
        token_data = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired",
        )

    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # 3. Validate DB record (allows manual revocation)
    record = await get_refresh_token_record(db, refresh_token)
    if not record or not record.is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or expired",
        )

    # 4. Issue new access token only (refresh token stays valid until DB expiry)
    new_access = create_access_token(record.user_id)

    return AccessTokenResponse(access_token=new_access)


# ---------------------------------------------------------------------------
# Logout (current device)
# ---------------------------------------------------------------------------


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke the current refresh token",
)
async def logout(payload: RefreshRequest, db: DBSession, _: CurrentUser):
    record = await get_refresh_token_record(db, payload.refresh_token)
    if record and record.is_valid:
        await revoke_refresh_token(db, record)
        await db.commit()
    return MessageResponse(message="Logged out successfully")


# ---------------------------------------------------------------------------
# Logout all devices
# ---------------------------------------------------------------------------


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Revoke all refresh tokens for the current user",
)
async def logout_all(current_user: CurrentUser, db: DBSession):
    count = await revoke_all_user_tokens(db, current_user.id)
    await db.commit()
    return MessageResponse(message=f"Logged out from {count} device(s)")


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user",
)
async def me(current_user: CurrentUser):
    return current_user


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change the current user's password and revoke all sessions",
)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    db: DBSession,
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    await change_user_password(db, current_user, payload.new_password)
    # Security: invalidate all existing sessions after password change
    await revoke_all_user_tokens(db, current_user.id)
    await db.commit()

    return MessageResponse(message="Password changed. Please log in again.")
