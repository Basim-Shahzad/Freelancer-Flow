from fastapi import APIRouter, Request, status, Cookie, Response

from app.api.dependencies.auth import CurrentUser, DBSession
from app.schemas.AuthSchema import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    UserCreate,
    UserResponse,
    AccessTokenResponse,
)
from app.db.crud import auth as auth_crud

router = APIRouter()


def _client_info(request: Request) -> dict[str, str | None]:
    return {
        "user_agent": request.headers.get("user-agent"),
        "ip_address": request.client.host if request.client else None,
    }


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    # Refresh token never leaves the server as JS-readable data — only via
    # this httponly cookie, so it can't be exfiltrated through XSS. The
    # access token is short-lived and handed back in the body for the
    # client to attach as an Authorization header.
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=604800,
    )


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
    return await auth_crud.register_user(db, payload)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=AccessTokenResponse,
    summary="Authenticate and receive an access token (refresh token set as httponly cookie)",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: DBSession,
    response: Response,
):
    access_token, refresh_token = await auth_crud.login(
        db, payload.email, payload.password, **_client_info(request)
    )
    _set_refresh_cookie(response, refresh_token)
    return AccessTokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Exchange a valid refresh token cookie for a new access token, rotating it",
)
async def refresh_tokens(
    request: Request,
    db: DBSession,
    response: Response,
    refresh_token: str = Cookie(None),
):
    access_token, new_refresh = await auth_crud.rotate_refresh_token(
        db, refresh_token, **_client_info(request)
    )
    _set_refresh_cookie(response, new_refresh)
    return AccessTokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Logout (current device)
# ---------------------------------------------------------------------------


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke the current refresh token",
)
async def logout(
    db: DBSession,
    response: Response,
    _: CurrentUser,
    refresh_token: str = Cookie(None),
):
    await auth_crud.logout(db, refresh_token)
    response.delete_cookie("refresh_token")
    return MessageResponse(message="Logged out successfully")


# ---------------------------------------------------------------------------
# Logout all devices
# ---------------------------------------------------------------------------


@router.post(
    "/logout-all",
    response_model=MessageResponse,
    summary="Revoke all refresh tokens for the current user",
)
async def logout_all(current_user: CurrentUser, db: DBSession, response: Response):
    count = await auth_crud.logout_everywhere(db, current_user.id)
    response.delete_cookie("refresh_token")
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
    await auth_crud.change_password(
        db, current_user, payload.current_password, payload.new_password
    )
    return MessageResponse(message="Password changed. Please log in again.")
