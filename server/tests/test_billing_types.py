"""Project billing types: retainer/hourly/milestone rules and progress_percent."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.ActivityEvent import ActivityEvent
from app.models.Milestone import MilestoneStatus
from app.models.Project import BillingType
from app.models.TimeEntry import TimeEntry
from app.services.project_progress import compute_progress_percent

PROJECTS_URL = "/api/v1/projects"


async def _create(client, headers, client_profile, **extra):
    return await client.post(
        PROJECTS_URL,
        json={"name": "P", "clientId": str(client_profile.id), **extra},
        headers=headers,
    )


async def test_retainer_requires_amount_and_interval(client, auth_headers, client_profile):
    for extra in ({}, {"retainerAmount": "500"}, {"retainerInterval": "MONTHLY"}):
        resp = await _create(client, auth_headers, client_profile, billingType="RETAINER", **extra)
        assert resp.status_code == 422, extra


async def test_retainer_yearly_interval_rejected(client, auth_headers, client_profile):
    resp = await _create(
        client, auth_headers, client_profile, billingType="RETAINER",
        retainerAmount="500", retainerInterval="YEARLY",
    )
    assert resp.status_code == 422


async def test_retainer_amount_must_be_positive(client, auth_headers, client_profile):
    resp = await _create(
        client, auth_headers, client_profile, billingType="RETAINER",
        retainerAmount="0", retainerInterval="MONTHLY",
    )
    assert resp.status_code == 422


async def test_retainer_defaults_start_date_and_returns_fields(client, auth_headers, client_profile):
    resp = await _create(
        client, auth_headers, client_profile, billingType="RETAINER",
        retainerAmount="500", retainerInterval="QUARTERLY",
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["retainerInterval"] == "QUARTERLY"
    assert Decimal(body["retainerAmount"]) == 500
    assert body["retainerStartDate"] is not None
    assert body["milestonesEnabled"] is False


async def test_retainer_fields_on_non_retainer_rejected(client, auth_headers, client_profile):
    resp = await _create(
        client, auth_headers, client_profile, billingType="FIXED", retainerAmount="500"
    )
    assert resp.status_code == 422


async def test_switching_away_from_retainer_clears_fields(client, auth_headers, client_profile):
    created = (await _create(
        client, auth_headers, client_profile, billingType="RETAINER",
        retainerAmount="500", retainerInterval="MONTHLY",
    )).json()
    resp = await client.patch(
        f"{PROJECTS_URL}/{created['id']}", json={"billingType": "FIXED"}, headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["retainerAmount"] is None
    assert resp.json()["retainerInterval"] is None


async def test_switching_to_retainer_on_update_requires_fields(client, auth_headers, client_profile):
    created = (await _create(client, auth_headers, client_profile)).json()
    bad = await client.patch(
        f"{PROJECTS_URL}/{created['id']}", json={"billingType": "RETAINER"}, headers=auth_headers
    )
    assert bad.status_code == 422
    ok = await client.patch(
        f"{PROJECTS_URL}/{created['id']}",
        json={"billingType": "RETAINER", "retainerAmount": "100", "retainerInterval": "MONTHLY"},
        headers=auth_headers,
    )
    assert ok.status_code == 200, ok.text


async def test_milestone_type_forces_milestones_enabled(client, auth_headers, client_profile):
    resp = await _create(client, auth_headers, client_profile, billingType="MILESTONE")
    assert resp.status_code == 201
    assert resp.json()["milestonesEnabled"] is True


async def test_milestone_type_rejects_disabling_milestones(client, auth_headers, client_profile):
    resp = await _create(
        client, auth_headers, client_profile, billingType="MILESTONE", milestonesEnabled=False
    )
    assert resp.status_code == 422
    created = (await _create(client, auth_headers, client_profile, billingType="MILESTONE")).json()
    resp = await client.patch(
        f"{PROJECTS_URL}/{created['id']}", json={"milestonesEnabled": False}, headers=auth_headers
    )
    assert resp.status_code == 422


async def test_hourly_defaults_to_freelancer_rate(
    client, auth_headers, client_profile, freelancer_profile, db_session
):
    freelancer_profile.hourly_rate = Decimal("75")
    await db_session.commit()
    resp = await _create(client, auth_headers, client_profile, billingType="HOURLY")
    assert Decimal(resp.json()["hourlyRate"]) == 75
    resp = await _create(
        client, auth_headers, client_profile, billingType="HOURLY", hourlyRate="120"
    )
    assert Decimal(resp.json()["hourlyRate"]) == 120


async def test_hourly_without_any_rate_stays_null(
    client, auth_headers, client_profile, freelancer_profile
):
    assert freelancer_profile.hourly_rate is None
    resp = await _create(client, auth_headers, client_profile, billingType="HOURLY")
    assert resp.status_code == 201
    assert resp.json()["hourlyRate"] is None


async def test_milestones_require_enabled_flag(client, auth_headers, client_profile):
    off = (await _create(client, auth_headers, client_profile)).json()
    resp = await client.post(
        "/api/v1/milestones", json={"name": "M1", "projectId": off["id"]}, headers=auth_headers
    )
    assert resp.status_code == 422, resp.text
    on = (await _create(client, auth_headers, client_profile, milestonesEnabled=True)).json()
    resp = await client.post(
        "/api/v1/milestones", json={"name": "M1", "projectId": on["id"]}, headers=auth_headers
    )
    assert resp.status_code == 201, resp.text


async def test_cannot_disable_milestones_while_they_exist(client, auth_headers, project, milestone):
    resp = await client.patch(
        f"{PROJECTS_URL}/{project.id}", json={"milestonesEnabled": False}, headers=auth_headers
    )
    assert resp.status_code == 409


async def test_update_billing_type_logs_activity_diff(
    client, auth_headers, client_profile, db_session
):
    created = (await _create(client, auth_headers, client_profile)).json()
    await client.patch(
        f"{PROJECTS_URL}/{created['id']}", json={"billingType": "HOURLY"}, headers=auth_headers
    )
    events = (await db_session.execute(
        select(ActivityEvent).where(
            ActivityEvent.entity_type == "project", ActivityEvent.action == "updated"
        )
    )).scalars().all()
    assert len(events) == 1
    assert "billing_type" in str(events[0].changes)


async def test_other_users_project_billing_update_is_404(client, other_auth_headers, project):
    resp = await client.patch(
        f"{PROJECTS_URL}/{project.id}", json={"billingType": "HOURLY"}, headers=other_auth_headers
    )
    assert resp.status_code == 404


async def test_progress_by_milestones(client, auth_headers, project, make_milestone):
    body = (await client.get(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)).json()
    assert body["progressPercent"] is None  # enabled but no milestones yet
    await make_milestone(project_id=project.id, name="a", status=MilestoneStatus.APPROVED)
    await make_milestone(project_id=project.id, name="b", status=MilestoneStatus.SUBMITTED)
    await make_milestone(project_id=project.id, name="c", status=MilestoneStatus.PENDING)
    await make_milestone(project_id=project.id, name="d", status=MilestoneStatus.REJECTED)
    body = (await client.get(f"{PROJECTS_URL}/{project.id}", headers=auth_headers)).json()
    assert body["progressPercent"] == 50
    listed = (await client.get(PROJECTS_URL, headers=auth_headers)).json()["projects"][0]
    assert listed["progressPercent"] == 50
    assert "milestoneTotal" not in body


async def test_progress_by_hours_for_hourly_budget(
    client, auth_headers, make_project, client_profile, user, db_session
):
    p = await make_project(
        client_id=client_profile.id, created_by=user.id, billing_type=BillingType.HOURLY,
        milestones_enabled=False, budget=Decimal("1000"), hourly_rate=Decimal("100"),
    )
    start = datetime.now(timezone.utc) - timedelta(hours=3)
    db_session.add(TimeEntry(
        description="x", start_time=start, end_time=start + timedelta(hours=2),
        duration_minutes=120, project_id=p.id, user_id=user.id, hourly_rate=Decimal("100"),
    ))
    await db_session.commit()
    body = (await client.get(f"{PROJECTS_URL}/{p.id}", headers=auth_headers)).json()
    assert body["progressPercent"] == 20  # 2h of a 10h budget


def _progress(**kw):
    base = dict(
        billing_type="FIXED", milestones_enabled=False, milestone_total=0,
        milestone_done=0, budget=None, hourly_rate=None, total_minutes=0,
    )
    return compute_progress_percent(**{**base, **kw})


def test_progress_function_rules():
    assert _progress() is None
    assert _progress(billing_type="HOURLY", budget=Decimal(1000)) is None  # no rate
    assert _progress(billing_type="HOURLY", hourly_rate=Decimal(100)) is None  # no budget
    assert _progress(billing_type="HOURLY", budget=Decimal(1000), hourly_rate=Decimal(0)) is None
    assert _progress(
        billing_type="HOURLY", budget=Decimal(100), hourly_rate=Decimal(100), total_minutes=600
    ) == 100  # capped
    assert _progress(milestones_enabled=True, milestone_total=3, milestone_done=1) == 33
    assert _progress(
        billing_type="HOURLY", milestones_enabled=True, milestone_total=2, milestone_done=2,
        budget=Decimal(1000), hourly_rate=Decimal(100), total_minutes=60,
    ) == 100  # milestones win over hours
    assert _progress(milestones_enabled=False, milestone_total=3, milestone_done=3) is None
