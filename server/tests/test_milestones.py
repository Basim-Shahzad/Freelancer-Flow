"""Tests for /api/v1/milestones (create + the GET-based submit flow)."""

import uuid

from sqlalchemy import select

from app.models.Milestone import Milestone, MilestoneStatus
from app.models.PortalAccessToken import PortalAccessToken, ScopeType

MILESTONES_URL = "/api/v1/milestones"


async def test_create_milestone_requires_auth(client, project):
    resp = await client.post(MILESTONES_URL, json={"name": "Phase 1", "project_id": str(project.id)})
    assert resp.status_code == 401


async def test_create_milestone_success(client, auth_headers, project):
    resp = await client.post(
        MILESTONES_URL,
        json={"name": "Phase 1", "project_id": str(project.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Phase 1"
    assert body["status"] == "PENDING"


async def test_create_milestone_for_nonexistent_project_should_not_500(client, auth_headers):
    """create_milestone() has no existence check on project_id -- a bad FK
    should be a clean 404/422, not an unhandled IntegrityError (500).
    Root cause: app/db/crud/milestones.py create_milestone()."""
    resp = await client.post(
        MILESTONES_URL,
        json={"name": "Ghost Milestone", "project_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code in (404, 422)


async def test_create_milestone_for_another_freelancers_project_is_rejected(
    client, auth_headers, other_user, db_session, make_client_profile, make_project
):
    """IDOR: create_milestone() never checks that the caller owns the
    project it's creating a milestone under -- any authenticated user can
    attach milestones to any project by guessing/enumerating project UUIDs.
    Root cause: app/api/v1/endpoints/milestones.py create_new_milestone()
    has no ownership check (contrast with the submit endpoint, which does)."""
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    foreign_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id, name="Not Yours", email="foreignmilestone@example.com"
    )
    foreign_project = await make_project(client_id=foreign_client.id, created_by=other_user.id)

    resp = await client.post(
        MILESTONES_URL,
        json={"name": "Sneaky Milestone", "project_id": str(foreign_project.id)},
        headers=auth_headers,
    )
    assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# GET /milestones/{id}/submit
# ---------------------------------------------------------------------------


def _submit_url(milestone_id, project_id) -> str:
    return f"{MILESTONES_URL}/{milestone_id}/submit?project_id={project_id}"


async def test_submit_milestone_requires_freelancer_profile(
    client, make_user, project, milestone
):
    no_freelancer_user = await make_user(email="submitnofl@example.com", with_freelancer=False)
    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(no_freelancer_user.id)}"}
    resp = await client.get(_submit_url(milestone.id, project.id), headers=headers)
    assert resp.status_code == 403


async def test_submit_milestone_project_not_owned_returns_404(
    client, other_auth_headers, project, milestone
):
    resp = await client.get(_submit_url(milestone.id, project.id), headers=other_auth_headers)
    assert resp.status_code == 404


async def test_submit_milestone_missing_project_id_query_param_is_422(
    client, auth_headers, milestone
):
    resp = await client.get(f"{MILESTONES_URL}/{milestone.id}/submit", headers=auth_headers)
    assert resp.status_code == 422


async def test_submit_pending_milestone_success(
    client, auth_headers, project, milestone, db_session
):
    resp = await client.get(_submit_url(milestone.id, project.id), headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "SUBMITTED"

    await db_session.refresh(milestone)
    assert milestone.status == MilestoneStatus.SUBMITTED


async def test_submit_milestone_issues_portal_token_scoped_to_project(
    client, auth_headers, project, milestone, db_session
):
    resp = await client.get(_submit_url(milestone.id, project.id), headers=auth_headers)
    assert resp.status_code == 200

    result = await db_session.execute(
        select(PortalAccessToken).where(PortalAccessToken.client_id == project.client_id)
    )
    tokens = result.scalars().all()
    assert len(tokens) == 1
    assert tokens[0].scope_type == ScopeType.PROJECT
    assert tokens[0].scope == project.id


async def test_submit_already_submitted_milestone_returns_conflict(
    client, auth_headers, project, milestone
):
    first = await client.get(_submit_url(milestone.id, project.id), headers=auth_headers)
    assert first.status_code == 200

    second = await client.get(_submit_url(milestone.id, project.id), headers=auth_headers)
    assert second.status_code == 409


async def test_submit_with_mismatched_but_owned_project_id_does_not_mutate_status(
    client, auth_headers, user, freelancer_profile, client_profile, milestone, make_project, db_session
):
    """Calling GET /milestones/{id}/submit?project_id=<a different project
    the caller also owns> flips the milestone's status to SUBMITTED via
    update_milestone_status() *before* the association check
    (`milestone.project_id != project_id`) runs and returns 404. The status
    mutation should not happen when the milestone doesn't belong to the
    given project.
    Root cause: app/api/v1/endpoints/milestones.py
    update_milestone_statuses() -- the association check needs to happen
    before calling update_milestone_status(), not after."""
    other_owned_project = await make_project(client_id=client_profile.id, created_by=user.id)

    resp = await client.get(
        _submit_url(milestone.id, other_owned_project.id), headers=auth_headers
    )
    assert resp.status_code == 404

    await db_session.refresh(milestone)
    assert milestone.status == MilestoneStatus.PENDING


async def test_milestone_approved_by_is_reported_in_list_response(
    client, auth_headers, project, milestone, db_session, client_profile
):
    """MilestoneResponse.approved_by has no matching ORM attribute (the real
    column is approved_by_client_id) -- from_attributes silently falls back
    to the field default, so the API can never actually report who approved
    a milestone via this list endpoint, even after a real approval.
    Root cause: app/schemas/MilestoneSchema.py MilestoneResponse.approved_by."""
    import uuid as uuid_module

    milestone.status = MilestoneStatus.APPROVED
    milestone.approved_by_client_id = client_profile.id
    db_session.add(milestone)
    await db_session.commit()

    resp = await client.get(f"/api/v1/projects/{project.id}/milestones/", headers=auth_headers)
    body = resp.json()
    approved = next(m for m in body["milestones"] if m["id"] == str(milestone.id))
    assert approved["approvedBy"] == str(client_profile.id)
