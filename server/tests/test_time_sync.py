"""POST /time-entries/sync"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.TimeEntry import TimeEntry

URL = "/api/v1/time-entries/sync"


def _item(project_id, *, hours_ago=3, length=1, running=False, **extra):
    start = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    return {
        "id": str(uuid.uuid4()),
        "startTime": start.isoformat(),
        "endTime": None if running else (start + timedelta(hours=length)).isoformat(),
        "projectId": str(project_id),
        "description": "Offline work",
        "isBillable": True,
        **extra,
    }


async def _sync(client, headers, *items):
    resp = await client.post(URL, json={"entries": list(items)}, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()["results"]


async def test_create_then_idempotent_resync(client, auth_headers, project, db_session):
    item = _item(project.id)
    [first] = await _sync(client, auth_headers, item)
    assert first["status"] == "created" and first["entry"]["durationMinutes"] == 60
    # Retry with the same (old) payload: no conflict, no duplicate.
    [again] = await _sync(client, auth_headers, item)
    assert again["status"] == "updated" and again["reason"] is None
    assert len((await db_session.execute(select(TimeEntry))).scalars().all()) == 1


async def test_update_with_current_version_and_stale_conflict(client, auth_headers, project):
    item = _item(project.id)
    [created] = await _sync(client, auth_headers, item)
    version = created["entry"]["updatedAt"]

    [ok] = await _sync(client, auth_headers, {**item, "description": "Edit 1", "updatedAt": version})
    assert ok["status"] == "updated" and ok["entry"]["description"] == "Edit 1"

    # A second client still holds the old version.
    [stale] = await _sync(client, auth_headers, {**item, "description": "Edit 2", "updatedAt": version})
    assert stale["status"] == "conflict" and stale["reason"] == "server_newer"
    assert stale["entry"]["description"] == "Edit 1"


async def test_invoiced_entry_protected(client, auth_headers, project, db_session):
    item = _item(project.id)
    await _sync(client, auth_headers, item)
    row = (await db_session.execute(select(TimeEntry))).scalar_one()
    row.is_invoiced = True
    await db_session.commit()
    [res] = await _sync(client, auth_headers, {**item, "description": "Changed"})
    assert res["status"] == "conflict" and res["reason"] == "invoiced"
    [res] = await _sync(client, auth_headers, {**item, "deleted": True})
    assert res["status"] == "conflict" and res["reason"] == "invoiced"


async def test_running_timer_conflict_does_not_fail_batch(client, auth_headers, project):
    first = _item(project.id, running=True, hours_ago=1)
    second = _item(project.id, running=True, hours_ago=0.5)
    ok = _item(project.id, hours_ago=10)
    res = await _sync(client, auth_headers, first, second, ok)
    assert [r["status"] for r in res] == ["created", "conflict", "created"]
    assert res[1]["reason"] == "timer_already_running"
    # Against a timer already on the server too.
    [again] = await _sync(client, auth_headers, _item(project.id, running=True, hours_ago=0.2))
    assert again["status"] == "conflict"


async def test_overlap_warning(client, auth_headers, project):
    a = _item(project.id, hours_ago=4, length=2)
    b = _item(project.id, hours_ago=3, length=2)
    c = _item(project.id, hours_ago=10, length=1)
    res = await _sync(client, auth_headers, a, b, c)
    assert [r["warning"] for r in res] == [None, "overlap", None]
    assert res[1]["status"] == "created"


async def test_foreign_owned_id_is_opaque_conflict(
    client, auth_headers, other_auth_headers, project, other_user,
    db_session, make_client_profile, make_project,
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    theirs = await make_client_profile(freelancer_id=other_user.freelancer.id)
    their_project = await make_project(client_id=theirs.id, created_by=other_user.id)
    item = _item(their_project.id)
    await _sync(client, other_auth_headers, item)

    mine = {**item, "projectId": str(project.id)}
    [res] = await _sync(client, auth_headers, mine)
    assert res["status"] == "conflict" and res["entry"] is None
    [res] = await _sync(client, auth_headers, {**mine, "deleted": True})
    assert res["status"] == "conflict"
    row = (await db_session.execute(select(TimeEntry))).scalar_one()
    assert row.project_id == their_project.id


async def test_offline_delete(client, auth_headers, project, db_session):
    item = _item(project.id)
    await _sync(client, auth_headers, item)
    [res] = await _sync(client, auth_headers, {**item, "deleted": True})
    assert res["status"] == "deleted"
    assert (await db_session.execute(select(TimeEntry))).scalars().all() == []
    [res] = await _sync(client, auth_headers, {**item, "deleted": True})
    assert res["status"] == "deleted"  # unknown id is a no-op


async def test_per_entry_validation(client, auth_headers, project):
    now = datetime.now(timezone.utc)
    bad_order = _item(project.id)
    bad_order["endTime"] = (datetime.fromisoformat(bad_order["startTime"]) - timedelta(hours=1)).isoformat()
    future = _item(project.id, hours_ago=-2)
    too_long = _item(project.id, hours_ago=30, length=25)
    no_project = _item(uuid.uuid4())
    good = _item(project.id, hours_ago=8)
    res = await _sync(client, auth_headers, bad_order, future, too_long, no_project, good)
    assert [r["status"] for r in res] == ["rejected"] * 4 + ["created"]
    assert res[3]["reason"] == "project_not_found"
    assert now  # silence unused


async def test_batch_limit_and_duplicates(client, auth_headers, project):
    resp = await client.post(
        URL, json={"entries": [_item(project.id) for _ in range(201)]}, headers=auth_headers
    )
    assert resp.status_code == 422
    item = _item(project.id)
    res = await _sync(client, auth_headers, item, item)
    assert [r["status"] for r in res] == ["created", "rejected"]


async def test_sync_requires_auth(client):
    assert (await client.post(URL, json={"entries": []})).status_code == 401
