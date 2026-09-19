"""Milestone money, ordering, transitions, POST submit and approval history."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.Milestone import Milestone, MilestoneStatus
from app.models.MilestoneApproval import MilestoneApproval
from app.models.PortalAccessToken import PortalAccessToken, ScopeType

MILESTONES_URL = "/api/v1/milestones"


async def _create(client, headers, project_id, **extra):
    resp = await client.post(
        MILESTONES_URL, json={"name": "M", "projectId": str(project_id), **extra}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_milestone_carries_amount_and_gets_sequential_sort_order(client, auth_headers, project):
    a = await _create(client, auth_headers, project.id, amount="500.50")
    b = await _create(client, auth_headers, project.id)
    c = await _create(client, auth_headers, project.id)
    assert Decimal(a["amount"]) == Decimal("500.50")
    assert b["amount"] is None
    assert [a["sortOrder"], b["sortOrder"], c["sortOrder"]] == [0, 1, 2]


async def test_negative_amount_is_rejected(client, auth_headers, project):
    resp = await client.post(
        MILESTONES_URL, json={"name": "M", "projectId": str(project.id), "amount": "-1"}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_create_time_is_per_row_not_import_time(client, auth_headers, project, db_session):
    """created_at used a non-lambda default, so every row got the server start time."""
    first = await _create(client, auth_headers, project.id)
    await __import__("asyncio").sleep(0.05)
    second = await _create(client, auth_headers, project.id)
    assert first["createdAt"] != second["createdAt"]


async def test_reorder_milestones(client, auth_headers, project):
    ids = [(await _create(client, auth_headers, project.id, name=f"M{i}"))["id"] for i in range(3)]
    resp = await client.put(
        f"/api/v1/projects/{project.id}/milestones/order",
        json={"milestoneIds": list(reversed(ids))},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    assert [m["id"] for m in resp.json()["milestones"]] == list(reversed(ids))

    listing = (await client.get(f"/api/v1/projects/{project.id}/milestones/", headers=auth_headers)).json()
    assert [m["id"] for m in listing["milestones"]] == list(reversed(ids))


async def test_reorder_requires_every_milestone_exactly_once(client, auth_headers, other_auth_headers, project):
    ids = [(await _create(client, auth_headers, project.id))["id"] for _ in range(2)]
    url = f"/api/v1/projects/{project.id}/milestones/order"
    for bad in ([ids[0]], [ids[0], ids[0]], [ids[0], str(uuid.uuid4())]):
        assert (await client.put(url, json={"milestoneIds": bad}, headers=auth_headers)).status_code == 422
    assert (await client.put(url, json={"milestoneIds": ids}, headers=other_auth_headers)).status_code == 404


async def test_patch_milestone_fields_and_ownership(client, auth_headers, other_auth_headers, project):
    m = await _create(client, auth_headers, project.id)
    url = f"{MILESTONES_URL}/{m['id']}"
    resp = await client.patch(url, json={"name": "Renamed", "amount": "250"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed" and Decimal(resp.json()["amount"]) == 250
    assert (await client.patch(url, json={"name": "x"}, headers=other_auth_headers)).status_code == 404
    assert (await client.get(url, headers=other_auth_headers)).status_code == 404
    assert (await client.delete(url, headers=other_auth_headers)).status_code == 404
    assert (await client.patch(url, json={"name": None}, headers=auth_headers)).status_code == 422


async def test_status_transition_matrix(client, auth_headers, project):
    m = await _create(client, auth_headers, project.id)
    url = f"{MILESTONES_URL}/{m['id']}"

    assert (await client.patch(url, json={"status": "SUBMITTED"}, headers=auth_headers)).status_code == 409
    assert (await client.patch(url, json={"status": "APPROVED"}, headers=auth_headers)).status_code == 409  # not started
    ok = await client.patch(url, json={"status": "IN_PROGRESS"}, headers=auth_headers)
    assert ok.status_code == 200 and ok.json()["status"] == "IN_PROGRESS"
    done = await client.patch(url, json={"status": "APPROVED"}, headers=auth_headers)
    assert done.status_code == 200 and done.json()["approvedAt"] is not None
    # Approved is final.
    assert (await client.patch(url, json={"status": "IN_PROGRESS"}, headers=auth_headers)).status_code == 409


async def test_freelancer_cannot_self_approve_when_client_approval_is_required(client, auth_headers, project):
    m = await _create(client, auth_headers, project.id, approvalRequired=True)
    url = f"{MILESTONES_URL}/{m['id']}"
    await client.patch(url, json={"status": "IN_PROGRESS"}, headers=auth_headers)
    resp = await client.patch(url, json={"status": "APPROVED"}, headers=auth_headers)
    assert resp.status_code == 409


async def test_post_submit_sets_submitted_at_and_issues_token(client, auth_headers, project, milestone, db_session):
    resp = await client.post(f"{MILESTONES_URL}/{milestone.id}/submit", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "SUBMITTED" and body["submittedAt"] is not None

    tokens = (await db_session.execute(select(PortalAccessToken))).scalars().all()
    assert len(tokens) == 1 and tokens[0].scope_type == ScopeType.PROJECT
    assert (await client.post(f"{MILESTONES_URL}/{milestone.id}/submit", headers=auth_headers)).status_code == 409


async def test_submit_is_ownership_checked(client, other_auth_headers, milestone):
    assert (await client.post(f"{MILESTONES_URL}/{milestone.id}/submit", headers=other_auth_headers)).status_code == 404


async def test_legacy_get_submit_is_marked_deprecated(client):
    schema = (await client.get("/api/v1/openapi.json")).json()
    assert schema["paths"]["/api/v1/milestones/{milestone_id}/submit"]["get"]["deprecated"] is True


async def test_rejected_milestone_can_be_reworked_and_resubmitted(
    client, auth_headers, project, milestone, make_portal_token, client_profile, db_session
):
    await client.post(f"{MILESTONES_URL}/{milestone.id}/submit", headers=auth_headers)
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    rejected = await client.post(
        f"/api/v1/portal/milestone/{milestone.id}/reject",
        json={"comment": "Needs more contrast"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["approvedBy"] == str(client_profile.id)

    approval = (await db_session.execute(select(MilestoneApproval))).scalar_one()
    assert approval.comment == "Needs more contrast"

    again = await client.post(f"{MILESTONES_URL}/{milestone.id}/submit", headers=auth_headers)
    assert again.status_code == 200
    assert again.json()["status"] == "SUBMITTED" and again.json()["approvedAt"] is None


async def test_portal_last_used_at_is_recorded(client, project, client_profile, make_portal_token, db_session):
    token, record = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    assert record.last_used_at is None
    resp = await client.get(f"/api/v1/portal/project/{project.id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    await db_session.refresh(record)
    assert record.last_used_at is not None


async def test_portal_project_view_hides_internal_fields(client, project, client_profile, make_portal_token, db_session):
    project.hourly_rate = Decimal("999")
    await db_session.commit()
    token, _ = await make_portal_token(
        client_id=client_profile.id, scope_type=ScopeType.PROJECT, scope=project.id
    )
    body = (
        await client.get(f"/api/v1/portal/project/{project.id}", headers={"Authorization": f"Bearer {token}"})
    ).json()
    assert "hourlyRate" not in body and "totalTimeSpentMinutes" not in body


async def test_milestone_and_token_created_at_use_per_row_defaults(db_session, project, make_milestone):
    """Regression: `default=datetime.now(...)` (no lambda) froze created_at at import time."""
    a = await make_milestone(project_id=project.id, name="A")
    await __import__("asyncio").sleep(0.05)
    b = await make_milestone(project_id=project.id, name="B")
    assert b.created_at > a.created_at
    assert abs((datetime.now(timezone.utc) - b.created_at).total_seconds()) < 60
