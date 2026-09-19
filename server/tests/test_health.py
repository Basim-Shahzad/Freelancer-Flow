async def test_health_check_reports_degraded_when_db_unreachable(client):
    """/health uses app.db.database's own module-level engine, which in this
    suite points at a deliberately fake/unreachable Postgres URL (see
    conftest.py) so tests never touch a real database via that path. It
    should degrade gracefully rather than raising."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["db"] == "disconnected"
    assert body["app"] == "Paylancer"
