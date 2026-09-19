"""Running timers, rate snapshots, entry edits and derived project time."""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

TIME_URL = "/api/v1/time-entries"


def _iso(dt):
    return dt.isoformat()


async def _start(client, headers, project_id, **extra):
    return await client.post(
        f"{TIME_URL}/start",
        json={"description": "Live work", "projectId": str(project_id), **extra},
        headers=headers,
    )


async def test_start_and_stop_timer(client, auth_headers, project):
    started_at = datetime.now(timezone.utc) - timedelta(minutes=90)
    resp = await _start(client, auth_headers, project.id, startTime=_iso(started_at))
    assert resp.status_code == 201, resp.text
    entry = resp.json()
    assert entry["isRunning"] is True and entry["endTime"] is None
    assert entry["durationMinutes"] == 0

    running = (await client.get(f"{TIME_URL}/running", headers=auth_headers)).json()
    assert running["id"] == entry["id"]

    stopped = await client.post(f"{TIME_URL}/entry/{entry['id']}/stop", headers=auth_headers)
    assert stopped.status_code == 200, stopped.text
    body = stopped.json()
    assert body["isRunning"] is False and body["endTime"] is not None
    assert body["durationMinutes"] == 90

    assert (await client.get(f"{TIME_URL}/running", headers=auth_headers)).json() is None
    again = await client.post(f"{TIME_URL}/entry/{entry['id']}/stop", headers=auth_headers)
    assert again.status_code == 409


async def test_only_one_running_timer_per_user(
    client, auth_headers, other_auth_headers, project, other_user,
    db_session, make_client_profile, make_project,
):
    assert (await _start(client, auth_headers, project.id)).status_code == 201
    assert (await _start(client, auth_headers, project.id)).status_code == 409

    # Another user is independent.
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    assert (await _start(client, other_auth_headers, their_project.id)).status_code == 201


async def test_timer_requires_owned_project_and_valid_start(client, auth_headers, other_auth_headers, project):
    assert (await _start(client, other_auth_headers, project.id)).status_code == 404
    future = _iso(datetime.now(timezone.utc) + timedelta(hours=2))
    assert (await _start(client, auth_headers, project.id, startTime=future)).status_code == 422


async def test_cannot_stop_someone_elses_timer(client, auth_headers, other_auth_headers, project):
    entry = (await _start(client, auth_headers, project.id)).json()
    resp = await client.post(f"{TIME_URL}/entry/{entry['id']}/stop", headers=other_auth_headers)
    assert resp.status_code == 404


async def test_running_endpoint_requires_auth(client):
    assert (await client.get(f"{TIME_URL}/running")).status_code == 401


async def test_rate_snapshot_prefers_request_then_project_then_profile(
    client, auth_headers, project, db_session
):
    await client.patch("/api/v1/profile", json={"hourlyRate": "100"}, headers=auth_headers)
    profile_rate = (await _start(client, auth_headers, project.id)).json()
    assert Decimal(profile_rate["hourlyRate"]) == 100
    await client.post(f"{TIME_URL}/entry/{profile_rate['id']}/stop", headers=auth_headers)

    project.hourly_rate = Decimal("150")
    await db_session.commit()
    project_rate = (await _start(client, auth_headers, project.id)).json()
    assert Decimal(project_rate["hourlyRate"]) == 150
    await client.post(f"{TIME_URL}/entry/{project_rate['id']}/stop", headers=auth_headers)

    explicit = (await _start(client, auth_headers, project.id, hourlyRate="90")).json()
    assert Decimal(explicit["hourlyRate"]) == 90


async def test_project_total_time_is_derived_from_entries(client, auth_headers, project):
    end = datetime.now(timezone.utc) - timedelta(minutes=1)
    for minutes in (60, 30):
        await client.post(
            TIME_URL,
            json={
                "description": "x", "isBillable": True, "projectId": str(project.id),
                "startTime": _iso(end - timedelta(minutes=minutes)), "endTime": _iso(end),
            },
            headers=auth_headers,
        )
    body = (await client.get(f"/api/v1/projects/{project.id}", headers=auth_headers)).json()
    assert body["totalTimeSpentMinutes"] == 90


async def test_update_and_delete_time_entry(client, auth_headers, other_auth_headers, project):
    end = datetime.now(timezone.utc) - timedelta(minutes=10)
    created = (
        await client.post(
            TIME_URL,
            json={
                "description": "x", "isBillable": True, "projectId": str(project.id),
                "startTime": _iso(end - timedelta(hours=1)), "endTime": _iso(end),
            },
            headers=auth_headers,
        )
    ).json()
    assert created["durationMinutes"] == 60
    url = f"{TIME_URL}/entry/{created['id']}"

    edited = await client.patch(
        url, json={"endTime": _iso(end + timedelta(minutes=5)), "description": "y"}, headers=auth_headers
    )
    assert edited.status_code == 200
    assert edited.json()["durationMinutes"] == 65 and edited.json()["description"] == "y"

    bad = await client.patch(url, json={"endTime": _iso(end - timedelta(hours=2))}, headers=auth_headers)
    assert bad.status_code == 422
    cleared = await client.patch(url, json={"endTime": None}, headers=auth_headers)
    assert cleared.status_code == 422  # cannot silently restart a stopped timer

    assert (await client.patch(url, json={"description": "z"}, headers=other_auth_headers)).status_code == 404
    assert (await client.delete(url, headers=other_auth_headers)).status_code == 404
    assert (await client.delete(url, headers=auth_headers)).status_code == 204


async def test_invoiced_entries_are_immutable(client, auth_headers, project, db_session):
    from app.models.TimeEntry import TimeEntry

    end = datetime.now(timezone.utc) - timedelta(minutes=10)
    created = (
        await client.post(
            TIME_URL,
            json={
                "description": "x", "isBillable": True, "projectId": str(project.id),
                "startTime": _iso(end - timedelta(hours=1)), "endTime": _iso(end),
            },
            headers=auth_headers,
        )
    ).json()
    entry = await db_session.get(TimeEntry, uuid.UUID(created["id"]))
    entry.is_invoiced = True
    await db_session.commit()

    url = f"{TIME_URL}/entry/{created['id']}"
    assert (await client.patch(url, json={"description": "z"}, headers=auth_headers)).status_code == 409
    assert (await client.delete(url, headers=auth_headers)).status_code == 409


async def test_entry_milestone_must_belong_to_project(client, auth_headers, project, user, client_profile, make_project, make_milestone):
    other_project = await make_project(client_id=client_profile.id, created_by=user.id, name="Other")
    foreign = await make_milestone(project_id=other_project.id)
    end = datetime.now(timezone.utc) - timedelta(minutes=10)
    resp = await client.post(
        TIME_URL,
        json={
            "description": "x", "isBillable": True, "projectId": str(project.id),
            "milestoneId": str(foreign.id),
            "startTime": _iso(end - timedelta(hours=1)), "endTime": _iso(end),
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_deleting_a_milestone_keeps_its_time_entries(client, auth_headers, project, milestone):
    end = datetime.now(timezone.utc) - timedelta(minutes=10)
    await client.post(
        TIME_URL,
        json={
            "description": "kept", "isBillable": True, "projectId": str(project.id),
            "milestoneId": str(milestone.id),
            "startTime": _iso(end - timedelta(hours=1)), "endTime": _iso(end),
        },
        headers=auth_headers,
    )
    assert (await client.delete(f"/api/v1/milestones/{milestone.id}", headers=auth_headers)).status_code == 204
    listing = (await client.get(f"{TIME_URL}/{project.id}", headers=auth_headers)).json()
    assert listing["total"] == 1
