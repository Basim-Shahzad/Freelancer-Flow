import asyncio
import jwt
import pytest
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token


REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
LOGOUT_URL = "/api/v1/auth/logout"
LOGOUT_ALL_URL = "/api/v1/auth/logout-all"
ME_URL = "/api/v1/auth/me"
CHANGE_PASSWORD_URL = "/api/v1/auth/change-password"


def _register_payload(email="new-user@example.com", password="Passw0rd1", full_name="New User"):
    return {"email": email, "password": password, "fullName": full_name}


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------


async def test_register_success_returns_user(client):
    resp = await client.post(REGISTER_URL, json=_register_payload())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["email"] == "new-user@example.com"
    assert body["fullName"] == "New User"
    assert body["role"] == "user"
    assert body["isVerified"] is False
    assert body["isActive"] is True
    assert "id" in body
    assert "password" not in body
    assert "hashedPassword" not in body


async def test_register_lowercases_email(client):
    resp = await client.post(REGISTER_URL, json=_register_payload(email="MixedCase@Example.COM"))
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == "mixedcase@example.com"


async def test_register_duplicate_email_rejected(client):
    await client.post(REGISTER_URL, json=_register_payload(email="dupe@example.com"))
    resp = await client.post(REGISTER_URL, json=_register_payload(email="dupe@example.com"))
    assert resp.status_code == 409


async def test_register_duplicate_email_different_case_still_rejected(client):
    """Emails are stored lowercased, so 'Dupe@Example.com' and
    'dupe@example.com' must be treated as the same account."""
    await client.post(REGISTER_URL, json=_register_payload(email="dupe@example.com"))
    resp = await client.post(REGISTER_URL, json=_register_payload(email="Dupe@Example.com"))
    assert resp.status_code == 409


@pytest.mark.parametrize(
    "password",
    ["short1A", "alllowercase1", "NoDigitsHere", "12345678"],
)
async def test_register_rejects_weak_passwords(client, password):
    resp = await client.post(REGISTER_URL, json=_register_payload(password=password))
    assert resp.status_code == 422, f"password {password!r} should have been rejected"


async def test_register_rejects_invalid_email_format(client):
    resp = await client.post(REGISTER_URL, json=_register_payload(email="not-an-email"))
    assert resp.status_code == 422


async def test_register_creates_usable_freelancer_profile(client):
    """create_user() always attaches a FreelancerProfile; verify this by
    exercising an endpoint that depends on current_user.freelancer existing
    (POST /clients would 500/AttributeError if it didn't)."""
    resp = await client.post(REGISTER_URL, json=_register_payload(email="freelancer2@example.com"))
    assert resp.status_code == 201
    login_resp = await client.post(
        LOGIN_URL, json={"email": "freelancer2@example.com", "password": "Passw0rd1"}
    )
    token = login_resp.json()["accessToken"]
    resp = await client.post(
        "/api/v1/clients",
        json={"name": "Acme", "email": "acme@example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


async def test_login_success_returns_access_token_and_refresh_cookie(client):
    await client.post(REGISTER_URL, json=_register_payload(email="login@example.com"))
    resp = await client.post(LOGIN_URL, json={"email": "login@example.com", "password": "Passw0rd1"})
    assert resp.status_code == 200, resp.text
    assert "accessToken" in resp.json()
    assert "refresh_token" in resp.cookies


async def test_login_is_case_insensitive_on_email(client):
    await client.post(REGISTER_URL, json=_register_payload(email="caseinsensitive@example.com"))
    resp = await client.post(
        LOGIN_URL, json={"email": "CaseInsensitive@Example.com", "password": "Passw0rd1"}
    )
    assert resp.status_code == 200, resp.text


async def test_login_wrong_password_rejected(client):
    await client.post(REGISTER_URL, json=_register_payload(email="wrongpass@example.com"))
    resp = await client.post(
        LOGIN_URL, json={"email": "wrongpass@example.com", "password": "WrongPass1"}
    )
    assert resp.status_code == 401


async def test_login_unknown_email_rejected(client):
    resp = await client.post(
        LOGIN_URL, json={"email": "doesnotexist@example.com", "password": "Passw0rd1"}
    )
    assert resp.status_code == 401


async def test_login_inactive_account_forbidden(client, make_user):
    await make_user(email="inactive@example.com", is_active=False)
    resp = await client.post(
        LOGIN_URL, json={"email": "inactive@example.com", "password": "Passw0rd1"}
    )
    assert resp.status_code == 403


async def test_login_updates_last_login_at(client):
    await client.post(REGISTER_URL, json=_register_payload(email="lastlogin@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "lastlogin@example.com", "password": "Passw0rd1"}
    )
    token = login_resp.json()["accessToken"]
    me_resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert me_resp.json()["lastLoginAt"] is not None


# ---------------------------------------------------------------------------
# /me and bearer-token validation
# ---------------------------------------------------------------------------


async def test_me_requires_authentication(client):
    resp = await client.get(ME_URL)
    assert resp.status_code == 401


async def test_me_rejects_garbage_token(client):
    resp = await client.get(ME_URL, headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


async def test_me_rejects_expired_token(client, user):
    expired = jwt.encode(
        {
            "sub": str(user.id),
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "iat": datetime.now(timezone.utc) - timedelta(minutes=10),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


async def test_me_rejects_refresh_token_used_as_access_token(client, user):
    refresh_token = create_refresh_token(user.id)
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {refresh_token}"})
    assert resp.status_code == 401


async def test_me_rejects_token_without_sub_claim(client):
    malformed = jwt.encode(
        {
            "type": "access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "iat": datetime.now(timezone.utc),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {malformed}"})
    assert resp.status_code == 401


async def test_me_rejects_token_for_nonexistent_user(client):
    import uuid

    ghost_token = create_access_token(uuid.uuid4())
    resp = await client.get(ME_URL, headers={"Authorization": f"Bearer {ghost_token}"})
    assert resp.status_code == 404


async def test_me_returns_current_user(client, user, auth_headers):
    resp = await client.get(ME_URL, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == user.email


def test_tokens_minted_in_the_same_second_for_the_same_subject_collide():
    """create_access_token()/create_refresh_token() build their JWT payload
    from `sub`, `type`, `exp` and `iat` only -- no jti/nonce. PyJWT encodes
    `iat`/`exp` at whole-second precision, so two tokens minted for the same
    user within the same wall-clock second are byte-for-byte identical.
    Since RefreshToken.token has a UNIQUE constraint, a user who logs in (or
    refreshes) twice within the same second gets an unhandled IntegrityError
    (500) on the second call instead of a working second session.
    Root cause: app/core/security.py _create_token() should include a
    unique jti claim (as issue_portal_token() already does for portal
    tokens)."""
    import uuid

    user_id = uuid.uuid4()
    token_a = create_refresh_token(user_id)
    token_b = create_refresh_token(user_id)
    assert token_a != token_b


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


async def test_refresh_without_cookie_rejected(client):
    resp = await client.post(REFRESH_URL)
    assert resp.status_code == 401


async def test_refresh_with_garbage_cookie_rejected(client):
    resp = await client.post(REFRESH_URL, cookies={"refresh_token": "garbage"})
    assert resp.status_code == 401


async def test_refresh_rotates_token_and_returns_new_access_token(client):
    await client.post(REGISTER_URL, json=_register_payload(email="rotate@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "rotate@example.com", "password": "Passw0rd1"}
    )
    old_refresh_cookie = login_resp.cookies["refresh_token"]

    # See test_tokens_minted_in_the_same_second_for_the_same_subject_collide:
    # without this gap, the rotated token can be minted in the same second
    # as the login token and collide on the refresh_tokens.token UNIQUE
    # constraint, which isn't what this test is about.
    await asyncio.sleep(1.05)
    refresh_resp = await client.post(REFRESH_URL, cookies={"refresh_token": old_refresh_cookie})
    assert refresh_resp.status_code == 200, refresh_resp.text
    assert "accessToken" in refresh_resp.json()
    new_refresh_cookie = refresh_resp.cookies["refresh_token"]
    assert new_refresh_cookie != old_refresh_cookie


async def test_refresh_rejects_reuse_of_already_rotated_token(client):
    """Once a refresh token has been used, it is revoked -- reusing it
    should fail (defends against replay of a captured refresh token)."""
    await client.post(REGISTER_URL, json=_register_payload(email="reuse@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "reuse@example.com", "password": "Passw0rd1"}
    )
    old_refresh_cookie = login_resp.cookies["refresh_token"]

    await asyncio.sleep(1.05)  # avoid the same-second token collision (see dedicated test above)
    first = await client.post(REFRESH_URL, cookies={"refresh_token": old_refresh_cookie})
    assert first.status_code == 200

    second = await client.post(REFRESH_URL, cookies={"refresh_token": old_refresh_cookie})
    assert second.status_code == 401


async def test_refresh_rejects_access_token_type(client, user):
    access_token = create_access_token(user.id)
    resp = await client.post(REFRESH_URL, cookies={"refresh_token": access_token})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout / logout-all
# ---------------------------------------------------------------------------


async def test_logout_revokes_refresh_token(client):
    await client.post(REGISTER_URL, json=_register_payload(email="logout@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "logout@example.com", "password": "Passw0rd1"}
    )
    access_token = login_resp.json()["accessToken"]
    refresh_cookie = login_resp.cookies["refresh_token"]

    logout_resp = await client.post(
        LOGOUT_URL,
        cookies={"refresh_token": refresh_cookie},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_resp.status_code == 200

    refresh_resp = await client.post(REFRESH_URL, cookies={"refresh_token": refresh_cookie})
    assert refresh_resp.status_code == 401


async def test_logout_requires_authentication(client):
    resp = await client.post(LOGOUT_URL)
    assert resp.status_code == 401


async def test_logout_all_revokes_every_session(client, user, auth_headers, db_session):
    """Two sessions are seeded directly via create_refresh_token_record
    (rather than two real logins back to back) to keep this test about
    logout-all's revoke-count/effect, independent of the same-second JWT
    collision covered by test_tokens_minted_in_the_same_second_for_the_
    same_subject_collide."""
    from app.db.crud.auth import create_refresh_token_record

    record1 = await create_refresh_token_record(db_session, user_id=user.id, token="session-token-1")
    record2 = await create_refresh_token_record(db_session, user_id=user.id, token="session-token-2")
    await db_session.commit()
    refresh1, refresh2 = record1.token, record2.token
    access_token = auth_headers["Authorization"].split(" ")[1]

    resp = await client.post(
        LOGOUT_ALL_URL, headers={"Authorization": f"Bearer {access_token}"}
    )
    assert resp.status_code == 200
    assert "2" in resp.json()["message"]

    for cookie in (refresh1, refresh2):
        refresh_resp = await client.post(REFRESH_URL, cookies={"refresh_token": cookie})
        assert refresh_resp.status_code == 401


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------


async def test_change_password_success(client):
    await client.post(REGISTER_URL, json=_register_payload(email="changepw@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "changepw@example.com", "password": "Passw0rd1"}
    )
    access_token = login_resp.json()["accessToken"]

    resp = await client.post(
        CHANGE_PASSWORD_URL,
        json={"currentPassword": "Passw0rd1", "newPassword": "NewPassw0rd2"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200, resp.text

    old_login = await client.post(
        LOGIN_URL, json={"email": "changepw@example.com", "password": "Passw0rd1"}
    )
    assert old_login.status_code == 401

    # avoid the same-second token collision (see dedicated test above)
    await asyncio.sleep(1.05)
    new_login = await client.post(
        LOGIN_URL, json={"email": "changepw@example.com", "password": "NewPassw0rd2"}
    )
    assert new_login.status_code == 200


async def test_change_password_revokes_existing_sessions(client):
    await client.post(REGISTER_URL, json=_register_payload(email="revokepw@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "revokepw@example.com", "password": "Passw0rd1"}
    )
    access_token = login_resp.json()["accessToken"]
    refresh_cookie = login_resp.cookies["refresh_token"]

    await client.post(
        CHANGE_PASSWORD_URL,
        json={"currentPassword": "Passw0rd1", "newPassword": "NewPassw0rd2"},
        headers={"Authorization": f"Bearer {access_token}"},
    )

    refresh_resp = await client.post(REFRESH_URL, cookies={"refresh_token": refresh_cookie})
    assert refresh_resp.status_code == 401


async def test_change_password_wrong_current_password_rejected(client):
    await client.post(REGISTER_URL, json=_register_payload(email="badcurrent@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "badcurrent@example.com", "password": "Passw0rd1"}
    )
    access_token = login_resp.json()["accessToken"]

    resp = await client.post(
        CHANGE_PASSWORD_URL,
        json={"currentPassword": "WrongOne1", "newPassword": "NewPassw0rd2"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 400


async def test_change_password_rejects_weak_new_password(client):
    await client.post(REGISTER_URL, json=_register_payload(email="weaknew@example.com"))
    login_resp = await client.post(
        LOGIN_URL, json={"email": "weaknew@example.com", "password": "Passw0rd1"}
    )
    access_token = login_resp.json()["accessToken"]

    resp = await client.post(
        CHANGE_PASSWORD_URL,
        json={"currentPassword": "Passw0rd1", "newPassword": "alllowercase"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 422
