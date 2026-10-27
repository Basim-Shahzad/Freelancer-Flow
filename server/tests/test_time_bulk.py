"""PATCH /time-entries/bulk"""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.models.ActivityEvent import ActivityEvent
from app.models.TimeEntry import TimeEntry

URL = "/api/v1/time-entries"


async def _log(client, headers, project_id, hours_ago=3, **extra):
    start = datetime.now(UTC) - timedelta(hours=hours_ago)
    resp = await client.post(
        URL,
        json={
            "description": "Work",
            "projectId": str(project_id),
            "startTime": start.isoformat(),
            "endTime": (start + timedelta(hours=1)).isoformat(),
            **extra,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _bulk(client, headers, ids, **set_):
    return await client.patch(
        f"{URL}/bulk", json={"ids": [str(i) for i in ids], "set": set_}, headers=headers
    )


async def test_bulk_edit_fields_and_summary_log(client, auth_headers, project, db_session):
    a = await _log(client, auth_headers, project.id, 5)
    b = await _log(client, auth_headers, project.id, 3)
    resp = await _bulk(client, auth_headers, [a["id"], b["id"]], isBillable=False, description="Edited")
    assert resp.status_code == 200, resp.text
    assert resp.json()["updated"] == 2
    for e in (await db_session.execute(select(TimeEntry))).scalars():
        await db_session.refresh(e)
        assert e.is_billable is False and e.description == "Edited"
    rows = (
        await db_session.execute(select(ActivityEvent).where(ActivityEvent.action == "bulk_updated"))
    ).scalars().all()
    assert len(rows) == 1 and rows[0].changes["count"] == 2


async def test_bulk_limit_and_empty_set(client, auth_headers, project):
    ids = [uuid.uuid4() for _ in range(201)]
    assert (await _bulk(client, auth_headers, ids, isBillable=False)).status_code == 422
    assert (await _bulk(client, auth_headers, [uuid.uuid4()])).status_code == 422
    assert (await _bulk(client, auth_headers, [uuid.uuid4()], projectId=None)).status_code == 422


async def test_bulk_is_all_or_nothing_with_foreign_id(
    client, auth_headers, other_auth_headers, project, db_session
):
    mine = await _log(client, auth_headers, project.id)
    resp = await _bulk(client, auth_headers, [mine["id"], uuid.uuid4()], description="X")
    assert resp.status_code == 404
    entry = (await db_session.execute(select(TimeEntry))).scalar_one()
    assert entry.description == "Work"
    # Someone else's id is also a 404.
    assert (await _bulk(client, other_auth_headers, [mine["id"]], description="X")).status_code == 404


async def test_bulk_invoiced_only_description(client, auth_headers, project, db_session):
    entry = await _log(client, auth_headers, project.id)
    row = (await db_session.execute(select(TimeEntry))).scalar_one()
    row.is_invoiced = True
    await db_session.commit()
    assert (await _bulk(client, auth_headers, [entry["id"]], isBillable=False)).status_code == 409
    assert (await _bulk(client, auth_headers, [entry["id"]], description="Renamed")).status_code == 200


async def test_bulk_project_change_resolves_rate(
    client, auth_headers, project, client_profile, user, make_project
):
    await client.patch("/api/v1/profile", json={"hourlyRate": "100"}, headers=auth_headers)
    entry = await _log(client, auth_headers, project.id)
    other = await make_project(
        client_id=client_profile.id, created_by=user.id, name="Second", hourly_rate=Decimal(250)
    )
    resp = await _bulk(client, auth_headers, [entry["id"]], projectId=str(other.id))
    assert resp.status_code == 200, resp.text
    listing = (await client.get(f"{URL}/{other.id}", headers=auth_headers)).json()
    assert Decimal(listing["timeEntries"][0]["hourlyRate"]) == 250


async def test_bulk_foreign_project_rejected(
    client, auth_headers, project, other_user, db_session, make_client_profile, make_project
):
    entry = await _log(client, auth_headers, project.id)
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    resp = await _bulk(client, auth_headers, [entry["id"]], projectId=str(their_project.id))
    assert resp.status_code == 404


async def test_bulk_milestone_rules(
    client, auth_headers, project, milestone, make_milestone, make_project,
    client_profile, user, other_user, db_session, make_client_profile,
):
    entry = await _log(client, auth_headers, project.id)
    ok = await _bulk(client, auth_headers, [entry["id"]], milestoneId=str(milestone.id))
    assert ok.status_code == 200, ok.text

    other = await make_project(client_id=client_profile.id, created_by=user.id, name="Other")
    foreign_ms = await make_milestone(project_id=other.id)
    # Milestone of another (own) project -> mismatch.
    assert (
        await _bulk(client, auth_headers, [entry["id"]], milestoneId=str(foreign_ms.id))
    ).status_code == 422
    # Moving an entry that has a milestone without saying what to do with it.
    assert (await _bulk(client, auth_headers, [entry["id"]], projectId=str(other.id))).status_code == 422
    # Explicit milestone on the new project works.
    assert (
        await _bulk(
            client, auth_headers, [entry["id"]], projectId=str(other.id), milestoneId=str(foreign_ms.id)
        )
    ).status_code == 200
    # Clearing is allowed.
    assert (await _bulk(client, auth_headers, [entry["id"]], milestoneId=None)).status_code == 200

    # Milestone owned by someone else -> 404.
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    their_ms = await make_milestone(project_id=their_project.id)
    assert (
        await _bulk(client, auth_headers, [entry["id"]], milestoneId=str(their_ms.id))
    ).status_code == 404
