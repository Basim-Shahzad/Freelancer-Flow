"""Tests for /api/v1/time-entries."""

import uuid
from datetime import datetime, timedelta, timezone

TIME_ENTRIES_URL = "/api/v1/time-entries"


def _entry_payload(project_id, start=None, end=None, description="Worked on it", billable=True):
    start = start or datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    end = end or datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)
    return {
        "description": description,
        "startTime": start.isoformat(),
        "endTime": end.isoformat(),
        "isBillable": billable,
        "projectId": str(project_id),
    }


async def test_create_time_entry_requires_auth(client, project):
    resp = await client.post(TIME_ENTRIES_URL, json=_entry_payload(project.id))
    assert resp.status_code == 401


async def test_create_time_entry_success(client, auth_headers, project):
    resp = await client.post(
        TIME_ENTRIES_URL, json=_entry_payload(project.id), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["description"] == "Worked on it"
    assert body["isBillable"] is True
    assert body["isInvoiced"] is False


async def test_create_time_entry_computes_duration_from_start_and_end(client, auth_headers, project):
    """Nothing computes duration_minutes from start_time/end_time anywhere
    in the create path, and TimeEntryCreate doesn't even accept a
    duration_minutes field -- every time entry is persisted with
    duration_minutes == 0 regardless of its actual span.
    Root cause: app/schemas/TimeEntrySchema.py TimeEntryCreate / app/db/crud/
    time_entries.py create_time_entry() should derive duration_minutes."""
    start = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    end = datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)
    resp = await client.post(
        TIME_ENTRIES_URL, json=_entry_payload(project.id, start=start, end=end), headers=auth_headers
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["durationMinutes"] == 120


async def test_create_time_entry_end_before_start_is_rejected(client, auth_headers, project):
    """There is no validation anywhere that end_time comes after
    start_time -- a negative-duration entry is currently accepted outright.
    Root cause: app/schemas/TimeEntrySchema.py TimeEntryBase needs a
    model_validator enforcing end_time > start_time."""
    start = datetime(2026, 1, 1, 11, 0, tzinfo=timezone.utc)
    end = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    resp = await client.post(
        TIME_ENTRIES_URL, json=_entry_payload(project.id, start=start, end=end), headers=auth_headers
    )
    assert resp.status_code == 422


async def test_create_time_entry_for_nonexistent_project_should_not_500(client, auth_headers):
    """create_time_entry() has no existence check on project_id -- a bad
    FK should be a clean 404/422, not an unhandled IntegrityError (500).
    Root cause: app/db/crud/time_entries.py create_time_entry()."""
    resp = await client.post(
        TIME_ENTRIES_URL, json=_entry_payload(uuid.uuid4()), headers=auth_headers
    )
    assert resp.status_code in (404, 422)


async def test_create_time_entry_for_another_freelancers_project_is_rejected(
    client, auth_headers, other_user, db_session, make_client_profile, make_project
):
    """IDOR: create_new_time_entry() calls create_time_entry() directly with
    no ownership check at all, unlike list_time_entries() (which correctly
    calls get_project_by_id(..., user_id=current_user.id) and 404s). Any
    authenticated user can log time against any project by guessing/
    enumerating project UUIDs.
    Root cause: app/api/v1/endpoints/time_entries.py create_new_time_entry()."""
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    foreign_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id, name="Not Yours", email="foreigntime@example.com"
    )
    foreign_project = await make_project(client_id=foreign_client.id, created_by=other_user.id)

    resp = await client.post(
        TIME_ENTRIES_URL, json=_entry_payload(foreign_project.id), headers=auth_headers
    )
    assert resp.status_code in (403, 404)


async def test_list_time_entries_requires_project_ownership(
    client, other_auth_headers, project
):
    resp = await client.get(f"{TIME_ENTRIES_URL}/{project.id}", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_list_time_entries_for_nonexistent_project_returns_404(client, auth_headers):
    resp = await client.get(f"{TIME_ENTRIES_URL}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_list_time_entries_returns_created_entries(client, auth_headers, project):
    await client.post(TIME_ENTRIES_URL, json=_entry_payload(project.id), headers=auth_headers)
    await client.post(
        TIME_ENTRIES_URL,
        json=_entry_payload(project.id, description="Second entry"),
        headers=auth_headers,
    )

    resp = await client.get(f"{TIME_ENTRIES_URL}/{project.id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["timeEntries"]) == 2


async def test_list_time_entries_pagination(client, auth_headers, project):
    for i in range(3):
        await client.post(
            TIME_ENTRIES_URL,
            json=_entry_payload(project.id, description=f"Entry {i}"),
            headers=auth_headers,
        )

    resp = await client.get(f"{TIME_ENTRIES_URL}/{project.id}?skip=0&limit=2", headers=auth_headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["timeEntries"]) == 2


async def test_limit_query_param_is_bounded(client, auth_headers, project):
    too_big = await client.get(f"{TIME_ENTRIES_URL}/{project.id}?limit=101", headers=auth_headers)
    assert too_big.status_code == 422
