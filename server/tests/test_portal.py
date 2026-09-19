"""Tests for /api/v1/portal (client-facing, portal-JWT authenticated)."""

import uuid
from datetime import timedelta

from sqlalchemy import select

from app.models.Milestone import Milestone, MilestoneStatus
from app.models.MilestoneApproval import MilestoneApproval, MilestoneApprovalDecision
from app.models.PortalAccessToken import ScopeType
from app.models.User import User

PORTAL_URL = "/api/v1/portal"


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Token validation
# ---------------------------------------------------------------------------


async def test_portal_project_requires_token(client, project):
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}")
    assert resp.status_code == 401


async def test_portal_project_rejects_garbage_token(client, project):
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth("garbage"))
    assert resp.status_code == 401


async def test_portal_project_rejects_expired_token(client, project, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id,
        scope_type=ScopeType.PROJECT,
        scope=project.id,
        expires_in=timedelta(days=-1),
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth(token))
    assert resp.status_code == 401


async def test_portal_project_rejects_revoked_token(client, project, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id,
        scope_type=ScopeType.PROJECT,
        scope=project.id,
        revoked=True,
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth(token))
    assert resp.status_code == 401


async def test_portal_token_accepted_via_query_param(client, project, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}?token={token}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Scoping
# ---------------------------------------------------------------------------


async def test_portal_project_rejects_wrong_project_scope(
    client, project, client_profile, user, make_project, make_portal_token
):
    other_project = await make_project(client_id=client_profile.id, created_by=user.id)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=other_project.id
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth(token))
    assert resp.status_code == 403


async def test_portal_project_rejects_milestone_scoped_token(
    client, project, client_profile, make_portal_token
):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.MILESTONE, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth(token))
    assert resp.status_code == 403


async def test_portal_get_project_success(client, project, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/project/{project.id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == str(project.id)


async def test_portal_get_milestone_success(client, project, milestone, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/milestone/{milestone.id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == str(milestone.id)


async def test_portal_get_milestone_belonging_to_other_client_returns_404(
    client, project, milestone, other_user, db_session, make_client_profile, make_portal_token
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    unrelated_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id, name="Unrelated", email="unrelated@example.com"
    )
    token, _ = await make_portal_token(
        client_id=unrelated_client.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.get(f"{PORTAL_URL}/milestone/{milestone.id}", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Approve / reject
# ---------------------------------------------------------------------------


async def test_approve_submitted_milestone_success(
    client, project, client_profile, make_milestone, make_portal_token, db_session
):
    submitted = await make_milestone(project_id=project.id, status=MilestoneStatus.SUBMITTED)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )

    resp = await client.post(
        f"{PORTAL_URL}/milestone/{submitted.id}/approve", headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "APPROVED"

    await db_session.refresh(submitted)
    assert submitted.status == MilestoneStatus.APPROVED
    assert submitted.approved_by_client_id == client_profile.id
    assert submitted.approved_at is not None

    result = await db_session.execute(
        select(MilestoneApproval).where(MilestoneApproval.milestone_id == submitted.id)
    )
    approval = result.scalar_one()
    assert approval.decision == MilestoneApprovalDecision.APPROVED
    assert approval.client_id == client_profile.id


async def test_reject_submitted_milestone_success(
    client, project, client_profile, make_milestone, make_portal_token, db_session
):
    submitted = await make_milestone(project_id=project.id, status=MilestoneStatus.SUBMITTED)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )

    resp = await client.post(
        f"{PORTAL_URL}/milestone/{submitted.id}/reject",
        json={"comment": "Logo is the wrong colour"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "REJECTED"

    approval = (await db_session.execute(select(MilestoneApproval))).scalar_one()
    assert approval.comment == "Logo is the wrong colour"


async def test_reject_without_a_reason_is_refused(
    client, project, client_profile, make_milestone, make_portal_token, db_session
):
    submitted = await make_milestone(project_id=project.id, status=MilestoneStatus.SUBMITTED)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    for body in (None, {"comment": "   "}):
        resp = await client.post(
            f"{PORTAL_URL}/milestone/{submitted.id}/reject", json=body, headers=_auth(token)
        )
        assert resp.status_code == 422

    await db_session.refresh(submitted)
    assert submitted.status == MilestoneStatus.SUBMITTED


async def test_approve_non_submitted_milestone_is_rejected(
    client, project, client_profile, milestone, make_portal_token
):
    """milestone fixture defaults to PENDING; only SUBMITTED milestones may
    be approved/rejected."""
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(f"{PORTAL_URL}/milestone/{milestone.id}/approve", headers=_auth(token))
    assert resp.status_code == 400


async def test_approve_milestone_wrong_scope_is_forbidden(
    client, project, client_profile, user, make_project, make_milestone, make_portal_token
):
    submitted = await make_milestone(project_id=project.id, status=MilestoneStatus.SUBMITTED)
    other_project = await make_project(client_id=client_profile.id, created_by=user.id)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=other_project.id
    )
    resp = await client.post(f"{PORTAL_URL}/milestone/{submitted.id}/approve", headers=_auth(token))
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Convert (guest client -> real login)
# ---------------------------------------------------------------------------


async def test_convert_client_creates_working_login(
    client, project, client_profile, make_portal_token, db_session
):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(
        f"{PORTAL_URL}/convert", json={"password": "Passw0rd1"}, headers=_auth(token)
    )
    assert resp.status_code == 200, resp.text

    await db_session.refresh(client_profile)
    assert client_profile.user_id is not None

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": client_profile.email, "password": "Passw0rd1"},
    )
    assert login_resp.status_code == 200


async def test_convert_already_converted_client_rejected(
    client, project, client_profile, make_portal_token, db_session
):
    client_profile.user_id = uuid.uuid4()
    db_session.add(client_profile)
    await db_session.commit()

    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(
        f"{PORTAL_URL}/convert", json={"password": "Passw0rd1"}, headers=_auth(token)
    )
    assert resp.status_code == 400


async def test_convert_conflicts_when_user_with_same_email_exists(
    client, project, client_profile, make_portal_token, make_user
):
    await make_user(email=client_profile.email, with_freelancer=False)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(
        f"{PORTAL_URL}/convert", json={"password": "Passw0rd1"}, headers=_auth(token)
    )
    assert resp.status_code == 409


async def test_convert_requires_min_length_password(client, project, client_profile, make_portal_token):
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(f"{PORTAL_URL}/convert", json={"password": "short1"}, headers=_auth(token))
    assert resp.status_code == 422


async def test_convert_should_enforce_same_password_strength_as_registration(
    client, project, client_profile, make_portal_token
):
    """UserCreate (used by /auth/register) requires an uppercase letter and
    a digit in addition to an 8-char minimum. PortalConvertRequest only
    enforces min_length=8, so a portal-converted account can end up with a
    much weaker password than a normally registered one.
    Root cause: app/api/v1/endpoints/client_portal.py PortalConvertRequest
    should reuse the same password_strength validator as UserCreate."""
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    resp = await client.post(
        f"{PORTAL_URL}/convert", json={"password": "alllowercase"}, headers=_auth(token)
    )
    assert resp.status_code == 422
