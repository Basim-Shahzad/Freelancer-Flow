"""Tests for /api/v1/projects."""

import uuid

PROJECTS_URL = "/api/v1/projects"


async def test_create_project_requires_auth(client, client_profile):
    resp = await client.post(
        PROJECTS_URL, json={"name": "Website", "clientId": str(client_profile.id)}
    )
    assert resp.status_code == 401


async def test_create_project_success(client, auth_headers, client_profile):
    resp = await client.post(
        PROJECTS_URL,
        json={"name": "Website Revamp", "clientId": str(client_profile.id), "budget": "1000.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Website Revamp"
    assert body["status"] == "DRAFT"
    assert body["client"]["id"] == str(client_profile.id)
    assert body["budget"] == "1000.00"


async def test_create_project_for_nonexistent_client_returns_422_not_500(client, auth_headers):
    """create_project() has no existence check on client_id -- a bad FK
    value should be a clean validation error, not an unhandled
    IntegrityError (500).
    Root cause: app/db/crud/projects.py create_project()."""
    resp = await client.post(
        PROJECTS_URL,
        json={"name": "Ghost Project", "clientId": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code in (404, 422)


async def test_create_project_with_another_freelancers_client_is_rejected(
    client, auth_headers, other_user, db_session, make_client_profile
):
    """IDOR: create_project() never verifies that client_id belongs to a
    client owned by the calling freelancer, so any authenticated user can
    attach a project to any other freelancer's client by guessing/
    enumerating client UUIDs.
    Root cause: app/db/crud/projects.py create_project() / app/schemas/
    ProjectsSchema.py ProjectCreate has no cross-ownership validation."""
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    foreign_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id,
        name="Not Yours",
        email="foreignclient@example.com",
    )

    resp = await client.post(
        PROJECTS_URL,
        json={"name": "Sneaky Project", "clientId": str(foreign_client.id)},
        headers=auth_headers,
    )
    assert resp.status_code in (403, 404)


async def test_get_project_success(client, auth_headers, project):
    resp = await client.get(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == str(project.id)


async def test_get_nonexistent_project_returns_404(client, auth_headers):
    resp = await client.get(f"{PROJECTS_URL}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_cannot_get_another_users_project(client, other_auth_headers, project):
    resp = await client.get(f"{PROJECTS_URL}/{project.id}", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_list_projects_only_returns_own_projects(
    client, auth_headers, other_auth_headers, project
):
    own_resp = await client.get(PROJECTS_URL, headers=auth_headers)
    assert own_resp.status_code == 200
    own_body = own_resp.json()
    assert own_body["total"] == 1
    assert own_body["projects"][0]["id"] == str(project.id)

    other_resp = await client.get(PROJECTS_URL, headers=other_auth_headers)
    assert other_resp.json()["total"] == 0


async def test_list_projects_filters_by_status(client, auth_headers, user, client_profile, make_project):
    await make_project(client_id=client_profile.id, created_by=user.id, name="Active One")
    from app.models.Project import ProjectStatus

    await make_project(
        client_id=client_profile.id,
        created_by=user.id,
        name="Archived One",
        status=ProjectStatus.ARCHIVED,
    )

    resp = await client.get(f"{PROJECTS_URL}?status=ARCHIVED", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["projects"][0]["name"] == "Archived One"


async def test_list_projects_filters_by_client_id(
    client, auth_headers, user, freelancer_profile, make_client_profile, make_project
):
    client_a = await make_client_profile(
        freelancer_id=freelancer_profile.id, name="Client A", email="clienta@example.com"
    )
    client_b = await make_client_profile(
        freelancer_id=freelancer_profile.id, name="Client B", email="clientb@example.com"
    )
    await make_project(client_id=client_a.id, created_by=user.id, name="Project A")
    await make_project(client_id=client_b.id, created_by=user.id, name="Project B")

    resp = await client.get(f"{PROJECTS_URL}?client_id={client_a.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["projects"][0]["name"] == "Project A"


async def test_list_projects_search_by_name(client, auth_headers, user, client_profile, make_project):
    await make_project(client_id=client_profile.id, created_by=user.id, name="Findable Project")
    await make_project(client_id=client_profile.id, created_by=user.id, name="Other")

    resp = await client.get(f"{PROJECTS_URL}?search=Findable", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["projects"][0]["name"] == "Findable Project"


async def test_limit_query_param_is_bounded(client, auth_headers):
    too_big = await client.get(f"{PROJECTS_URL}?limit=101", headers=auth_headers)
    assert too_big.status_code == 422
    too_small = await client.get(f"{PROJECTS_URL}?limit=0", headers=auth_headers)
    assert too_small.status_code == 422


async def test_update_project_success(client, auth_headers, project):
    resp = await client.patch(
        f"{PROJECTS_URL}/{project.id}", json={"name": "New Name", "status": "PAUSED"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "New Name"
    assert body["status"] == "PAUSED"


async def test_cannot_update_another_users_project(client, other_auth_headers, project):
    resp = await client.patch(
        f"{PROJECTS_URL}/{project.id}", json={"name": "Hijacked"}, headers=other_auth_headers
    )
    assert resp.status_code == 404


async def test_update_project_client_id_to_foreign_client_is_rejected(
    client, auth_headers, project, other_user, db_session, make_client_profile
):
    """Same IDOR class as project creation: PATCH allows re-pointing an
    owned project at a client_id belonging to a different freelancer, with
    no cross-ownership validation.
    Root cause: app/db/crud/projects.py update_project()."""
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    foreign_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id, name="Not Yours", email="foreign2@example.com"
    )

    resp = await client.patch(
        f"{PROJECTS_URL}/{project.id}",
        json={"clientId": str(foreign_client.id)},
        headers=auth_headers,
    )
    assert resp.status_code in (403, 404)


async def test_delete_project_success(client, auth_headers, project):
    resp = await client.delete(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)
    assert resp.status_code == 204

    get_resp = await client.get(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_cannot_delete_another_users_project(client, other_auth_headers, project):
    resp = await client.delete(f"{PROJECTS_URL}/{project.id}", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_delete_project_cascades_to_milestones(
    client, auth_headers, project, milestone, db_session
):
    resp = await client.delete(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)
    assert resp.status_code == 204

    from app.models.Milestone import Milestone
    from sqlalchemy import select

    result = await db_session.execute(select(Milestone).where(Milestone.id == milestone.id))
    assert result.scalar_one_or_none() is None


# ---------------------------------------------------------------------------
# Nested milestones listing: GET /projects/{id}/milestones/
# ---------------------------------------------------------------------------


async def test_list_milestones_requires_freelancer_profile(client, make_user, project):
    """A user with no FreelancerProfile (e.g. a converted portal client)
    should be forbidden, not crash."""
    no_freelancer_user = await make_user(
        email="nofreelancer@example.com", with_freelancer=False
    )
    from app.core.security import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(no_freelancer_user.id)}"}
    resp = await client.get(f"{PROJECTS_URL}/{project.id}/milestones/", headers=headers)
    assert resp.status_code == 403


async def test_list_milestones_for_foreign_project_returns_404(
    client, other_auth_headers, project
):
    resp = await client.get(f"{PROJECTS_URL}/{project.id}/milestones/", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_list_milestones_returns_project_milestones(client, auth_headers, project, milestone):
    resp = await client.get(f"{PROJECTS_URL}/{project.id}/milestones/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["milestones"][0]["id"] == str(milestone.id)
