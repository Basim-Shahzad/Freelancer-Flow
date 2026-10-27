"""GET /dashboard/summary (Step 12): every number, exclusions and month boundaries."""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.models.Expense import RecurrenceInterval
from app.models.Invoice import Invoice, InvoiceStatus
from app.models.InvoiceItem import InvoiceItem
from app.models.Milestone import MilestoneStatus
from app.models.Payment import Payment
from app.models.Project import BillingType, ProjectStatus
from app.models.TimeEntry import TimeEntry

URL = "/api/v1/dashboard/summary"
UTC = UTC


def _first_of_month(day: date, offset: int = 0) -> date:
    index = day.year * 12 + day.month - 1 + offset
    year, month = divmod(index, 12)
    return date(year, month + 1, 1)


def _local(tz: str, day: date, hour: int, minute: int) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=ZoneInfo(tz)).astimezone(UTC)


def _today(tz: str) -> date:
    return datetime.now(UTC).astimezone(ZoneInfo(tz)).date()


async def _invoice(
    db, freelancer, client_profile, project, *, total="1000", currency="USD",
    status=InvoiceStatus.SENT, due_in_days=10, **extra,
) -> Invoice:
    now = datetime.now(UTC)
    invoice = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8]}",
        issue_date=now,
        due_date=now + timedelta(days=due_in_days),
        status=status,
        currency=currency,
        freelancer_id=freelancer.id,
        client_id=client_profile.id,
        project_id=project.id,
        subtotal=Decimal(total),
        total=Decimal(total),
        **extra,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


async def _pay(db, invoice, amount, paid_at=None) -> Payment:
    payment = Payment(
        invoice_id=invoice.id, amount=Decimal(amount), paid_at=paid_at or datetime.now(UTC)
    )
    db.add(payment)
    await db.commit()
    return payment


async def _entry(db, user, project, *, minutes=60, rate="100", billable=True,
                 invoiced=False, running=False) -> TimeEntry:
    start = datetime.now(UTC) - timedelta(hours=5)
    entry = TimeEntry(
        description="work",
        start_time=start,
        end_time=None if running else start + timedelta(minutes=minutes),
        duration_minutes=0 if running else minutes,
        is_billable=billable,
        is_invoiced=invoiced,
        hourly_rate=Decimal(rate),
        user_id=user.id,
        project_id=project.id,
    )
    db.add(entry)
    await db.commit()
    return entry


async def _get(client, headers):
    resp = await client.get(URL, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def _amounts(items):
    return {i["currency"]: Decimal(i["amount"]) for i in items}


async def test_requires_auth_and_a_freelancer_profile(client, make_user):
    assert (await client.get(URL)).status_code == 401
    from app.core.security import create_access_token

    bare = await make_user(with_freelancer=False)
    headers = {"Authorization": f"Bearer {create_access_token(bare.id)}"}
    assert (await client.get(URL, headers=headers)).status_code == 403


async def test_empty_world_has_the_full_shape(client, auth_headers, freelancer_profile):
    body = await _get(client, auth_headers)
    assert body["cashIn"]["thisMonth"] == []
    assert body["cashIn"]["lastMonth"] == []
    assert body["cashIn"]["timezone"] == "UTC"
    assert body["outstanding"] == {"byCurrency": []}
    assert body["unbilled"] == {"time": [], "milestones": [], "retainerPeriods": []}
    assert body["runningTimer"] is None
    assert body["activeProjects"] == 0


async def test_cash_in_groups_by_currency_and_splits_months(
    client, auth_headers, db_session, freelancer_profile, client_profile, project
):
    today = _today("UTC")
    this_start = _first_of_month(today)
    last_day_prev = this_start - timedelta(days=1)
    usd = await _invoice(db_session, freelancer_profile, client_profile, project, status=InvoiceStatus.PAID)
    pkr = await _invoice(
        db_session, freelancer_profile, client_profile, project, currency="PKR",
        total="50000", status=InvoiceStatus.PAID,
    )
    await _pay(db_session, usd, "300", _local("UTC", this_start, 0, 5))
    await _pay(db_session, usd, "200", _local("UTC", last_day_prev, 23, 55))
    await _pay(db_session, pkr, "50000", _local("UTC", this_start, 0, 10))
    # Older than last month: ignored.
    await _pay(db_session, usd, "999", _local("UTC", _first_of_month(today, -2), 12, 0))

    body = await _get(client, auth_headers)
    assert _amounts(body["cashIn"]["thisMonth"]) == {"PKR": Decimal(50000), "USD": Decimal(300)}
    assert _amounts(body["cashIn"]["lastMonth"]) == {"USD": Decimal(200)}
    assert body["cashIn"]["thisMonthStart"] == this_start.isoformat()


async def test_cash_in_month_boundary_follows_profile_timezone(
    client, auth_headers, db_session, freelancer_profile, client_profile, project
):
    tz = "Asia/Karachi"
    freelancer_profile.timezone = tz
    await db_session.commit()
    this_start = _first_of_month(_today(tz))
    invoice = await _invoice(db_session, freelancer_profile, client_profile, project, status=InvoiceStatus.PAID)
    # 00:30 on the 1st in Karachi is still the previous day in UTC.
    await _pay(db_session, invoice, "100", _local(tz, this_start, 0, 30))
    # 23:30 on the last day of last month in Karachi.
    await _pay(db_session, invoice, "40", _local(tz, this_start - timedelta(days=1), 23, 30))

    body = await _get(client, auth_headers)
    assert _amounts(body["cashIn"]["thisMonth"]) == {"USD": Decimal(100)}
    assert _amounts(body["cashIn"]["lastMonth"]) == {"USD": Decimal(40)}
    assert body["cashIn"]["timezone"] == tz

    # The same instants read as last month once the profile is in UTC.
    freelancer_profile.timezone = "UTC"
    await db_session.commit()
    body = await _get(client, auth_headers)
    assert _amounts(body["cashIn"]["lastMonth"]) == {"USD": Decimal(140)}
    assert body["cashIn"]["thisMonth"] == []


async def test_cash_in_ignores_other_freelancers(
    client, auth_headers, db_session, freelancer_profile, other_user, make_client_profile,
    make_project,
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    other_fl = other_user.freelancer
    other_client = await make_client_profile(freelancer_id=other_fl.id)
    other_project = await make_project(client_id=other_client.id, created_by=other_user.id)
    inv = await _invoice(db_session, other_fl, other_client, other_project)
    await _pay(db_session, inv, "500")
    body = await _get(client, auth_headers)
    assert body["cashIn"]["thisMonth"] == []
    assert body["outstanding"]["byCurrency"] == []
    assert body["activeProjects"] == 0


async def test_outstanding_balance_overdue_and_exclusions(
    client, auth_headers, db_session, freelancer_profile, client_profile, project
):
    args = (db_session, freelancer_profile, client_profile, project)
    sent = await _invoice(*args, total="1000", status=InvoiceStatus.SENT)
    part = await _invoice(*args, total="2000", status=InvoiceStatus.PARTIALLY_PAID, due_in_days=-3)
    await _pay(db_session, part, "500")
    await _invoice(*args, total="300", currency="PKR", due_in_days=-1)
    # Excluded: draft, cancelled, written off, paid.
    await _invoice(*args, total="111", status=InvoiceStatus.DRAFT)
    await _invoice(*args, total="222", status=InvoiceStatus.CANCELLED)
    await _invoice(*args, total="333", status=InvoiceStatus.WRITTEN_OFF)
    paid = await _invoice(*args, total="444", status=InvoiceStatus.PAID)
    await _pay(db_session, paid, "444")
    assert sent.id != part.id

    rows = {r["currency"]: r for r in (await _get(client, auth_headers))["outstanding"]["byCurrency"]}
    assert set(rows) == {"USD", "PKR"}
    usd = rows["USD"]
    assert Decimal(usd["balance"]) == Decimal(2500)  # 1000 + (2000 - 500)
    assert usd["count"] == 2
    assert Decimal(usd["overdueBalance"]) == Decimal(1500)
    assert usd["overdueCount"] == 1
    pkr = rows["PKR"]
    assert Decimal(pkr["balance"]) == Decimal(300)
    assert (pkr["count"], pkr["overdueCount"]) == (1, 1)
    assert Decimal(pkr["overdueBalance"]) == Decimal(300)


async def test_unbilled_time_per_project_at_snapshot_rates(
    client, auth_headers, db_session, user, freelancer_profile, client_profile, project,
    make_project,
):
    other = await make_project(client_id=client_profile.id, created_by=user.id, name="Zeta")
    await _entry(db_session, user, project, minutes=90, rate="100")  # 150
    await _entry(db_session, user, project, minutes=30, rate="60")  # 30
    await _entry(db_session, user, other, minutes=45, rate="80")  # 60
    # Excluded: non-billable, invoiced, still running.
    await _entry(db_session, user, project, minutes=60, billable=False)
    await _entry(db_session, user, project, minutes=60, invoiced=True)
    await _entry(db_session, user, project, running=True)

    unbilled = (await _get(client, auth_headers))["unbilled"]["time"]
    by_name = {r["projectName"]: r for r in unbilled}
    assert set(by_name) == {"Website Revamp", "Zeta"}
    assert Decimal(by_name["Website Revamp"]["hours"]) == Decimal("2.00")
    assert Decimal(by_name["Website Revamp"]["amount"]) == Decimal("180.00")
    assert Decimal(by_name["Zeta"]["hours"]) == Decimal("0.75")
    assert Decimal(by_name["Zeta"]["amount"]) == Decimal("60.00")
    assert by_name["Zeta"]["currency"] == "USD"


async def test_unbilled_milestones_only_approved_and_uninvoiced(
    client, auth_headers, db_session, freelancer_profile, client_profile, project, make_milestone
):
    ok1 = await make_milestone(project_id=project.id, name="A", status=MilestoneStatus.APPROVED, amount=Decimal(400))
    await make_milestone(project_id=project.id, name="B", status=MilestoneStatus.APPROVED, amount=Decimal(250))
    await make_milestone(project_id=project.id, name="submitted", status=MilestoneStatus.SUBMITTED, amount=Decimal(999))
    await make_milestone(project_id=project.id, name="no amount", status=MilestoneStatus.APPROVED)
    billed = await make_milestone(project_id=project.id, name="billed", status=MilestoneStatus.APPROVED, amount=Decimal(700))
    freed = await make_milestone(project_id=project.id, name="freed", status=MilestoneStatus.APPROVED, amount=Decimal(50))

    live = await _invoice(db_session, freelancer_profile, client_profile, project)
    cancelled = await _invoice(db_session, freelancer_profile, client_profile, project, status=InvoiceStatus.CANCELLED)
    for inv, ms in ((live, billed), (cancelled, freed)):
        db_session.add(
            InvoiceItem(
                invoice_id=inv.id, milestone_id=ms.id, description=ms.name,
                quantity=Decimal(1), unit_price=ms.amount, amount=ms.amount,
            )
        )
    await db_session.commit()
    assert ok1.id

    rows = (await _get(client, auth_headers))["unbilled"]["milestones"]
    assert len(rows) == 1
    assert rows[0]["count"] == 3  # A, B and the one freed by the cancelled invoice
    assert Decimal(rows[0]["amount"]) == Decimal(700)  # 400 + 250 + 50


async def test_unbilled_retainer_periods_include_past_and_current(
    client, auth_headers, db_session, user, freelancer_profile, client_profile, make_project
):
    today = _today("UTC")
    retainer = await make_project(
        client_id=client_profile.id,
        created_by=user.id,
        name="Retainer",
        billing_type=BillingType.RETAINER,
        retainer_amount=Decimal(1500),
        retainer_interval=RecurrenceInterval.MONTHLY,
        retainer_start_date=_first_of_month(today, -2),
    )
    # A paused retainer is not "due".
    await make_project(
        client_id=client_profile.id, created_by=user.id, name="Paused", status=ProjectStatus.PAUSED,
        billing_type=BillingType.RETAINER, retainer_amount=Decimal(10),
        retainer_interval=RecurrenceInterval.MONTHLY, retainer_start_date=_first_of_month(today, -1),
    )
    first = _first_of_month(today, -2)
    await _invoice(
        db_session, freelancer_profile, client_profile, retainer, retainer_period_start=first
    )
    # A cancelled invoice does not cover its period.
    await _invoice(
        db_session, freelancer_profile, client_profile, retainer, status=InvoiceStatus.CANCELLED,
        retainer_period_start=_first_of_month(today, -1),
    )

    rows = (await _get(client, auth_headers))["unbilled"]["retainerPeriods"]
    assert [r["periodStart"] for r in rows] == [
        _first_of_month(today, -1).isoformat(),
        _first_of_month(today).isoformat(),
    ]
    assert all(Decimal(r["amount"]) == Decimal(1500) for r in rows)
    assert all(r["projectName"] == "Retainer" for r in rows)


async def test_running_timer_and_active_projects(
    client, auth_headers, db_session, user, freelancer_profile, client_profile, project, make_project
):
    await make_project(client_id=client_profile.id, created_by=user.id, status=ProjectStatus.COMPLETED)
    body = await _get(client, auth_headers)
    assert body["runningTimer"] is None
    assert body["activeProjects"] == 1

    entry = await _entry(db_session, user, project, running=True)
    timer = (await _get(client, auth_headers))["runningTimer"]
    assert timer["id"] == str(entry.id)
    assert timer["projectName"] == "Website Revamp"
    assert 299 <= timer["elapsedMinutes"] <= 302
