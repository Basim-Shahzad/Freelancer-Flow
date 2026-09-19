"""
Tests for /api/v1/clients.

Several of these assert the *correct* expected behavior per the app's own
data model / access-control intent, not the code's current behavior, and are
expected to fail today. Each such test has a comment explaining the gap and
its root cause so it's actionable.
"""

CLIENTS_URL = "/api/v1/clients"


async def test_create_client_requires_auth(client):
    resp = await client.post(CLIENTS_URL, json={"name": "Acme", "email": "acme@example.com"})
    assert resp.status_code == 401


async def test_create_client_success(client, auth_headers):
    resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme Co", "email": "acme@example.com", "phone": "555-1234"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Acme Co"
    assert body["email"] == "acme@example.com"
    assert body["phone"] == "555-1234"
    assert "id" in body


async def test_create_client_without_email_should_be_a_validation_error(client, auth_headers):
    """ClientProfile.email is nullable=False at the DB layer, but ClientCreate
    declares `email: Optional[str] = None`. Omitting email should therefore
    be rejected with a clean 422 at the API boundary -- instead it currently
    reaches the DB and raises an unhandled IntegrityError (500).
    Bug: app/schemas/ClientsSchema.py ClientCreate.email should be required."""
    resp = await client.post(CLIENTS_URL, json={"name": "No Email Co"}, headers=auth_headers)
    assert resp.status_code == 422


async def test_create_client_duplicate_email_same_freelancer_should_be_conflict(
    client, auth_headers
):
    """clients(freelancer_id, email) has a DB unique constraint
    (uq_client_freelancer_email). Violating it should surface as a clean 409,
    matching the pattern already used in the register endpoint -- but
    create_client() doesn't catch IntegrityError, so this currently 500s.
    Bug: app/db/crud/clients.py create_client() needs a try/except IntegrityError."""
    payload = {"name": "Acme Co", "email": "dupe-client@example.com"}
    first = await client.post(CLIENTS_URL, json=payload, headers=auth_headers)
    assert first.status_code == 201

    second = await client.post(CLIENTS_URL, json=payload, headers=auth_headers)
    assert second.status_code == 409


async def test_create_client_duplicate_email_different_freelancer_allowed(
    client, auth_headers, other_auth_headers
):
    """The uniqueness constraint is scoped per-freelancer, so two different
    freelancers may each have a client with the same email."""
    payload = {"name": "Acme Co", "email": "shared-email@example.com"}
    first = await client.post(CLIENTS_URL, json=payload, headers=auth_headers)
    second = await client.post(CLIENTS_URL, json=payload, headers=other_auth_headers)
    assert first.status_code == 201
    assert second.status_code == 201


async def test_freelancer_can_list_their_own_clients(client, auth_headers):
    """A freelancer who creates a client should see it in their own client
    list. Bug: get_clients()/list_clients filter by ClientProfile.user_id
    (the guest->registered-client conversion link, NULL for normal clients)
    instead of ClientProfile.freelancer_id, so newly created clients never
    show up for their own owning freelancer.
    Root cause: app/db/crud/clients.py get_clients() and
    app/api/v1/endpoints/clients.py list_clients()."""
    create_resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme Co", "email": "listme@example.com"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    created_id = create_resp.json()["id"]

    list_resp = await client.get(CLIENTS_URL, headers=auth_headers)
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert body["total"] == 1
    assert any(c["id"] == created_id for c in body["clients"])


async def test_freelancer_can_fetch_their_own_client_by_id(client, auth_headers):
    """Same root cause as above -- GET /clients/{id} also filters by
    ClientProfile.user_id instead of freelancer_id."""
    create_resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme Co", "email": "fetchme@example.com"},
        headers=auth_headers,
    )
    created_id = create_resp.json()["id"]

    get_resp = await client.get(f"{CLIENTS_URL}/{created_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == created_id


async def test_freelancer_can_update_their_own_client(client, auth_headers):
    """Same root cause as above -- PATCH /clients/{id} also filters by
    ClientProfile.user_id instead of freelancer_id."""
    create_resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme Co", "email": "updateme@example.com"},
        headers=auth_headers,
    )
    created_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"{CLIENTS_URL}/{created_id}", json={"name": "Acme Corp"}, headers=auth_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "Acme Corp"


async def test_freelancer_can_delete_their_own_client(client, auth_headers):
    """Same root cause as above -- DELETE /clients/{id} also filters by
    ClientProfile.user_id instead of freelancer_id."""
    create_resp = await client.post(
        CLIENTS_URL,
        json={"name": "Acme Co", "email": "deleteme@example.com"},
        headers=auth_headers,
    )
    created_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"{CLIENTS_URL}/{created_id}", headers=auth_headers)
    assert delete_resp.status_code == 204


async def test_get_nonexistent_client_returns_404(client, auth_headers):
    import uuid

    resp = await client.get(f"{CLIENTS_URL}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_client_list_pagination_should_paginate_owned_clients(
    client, user, freelancer_profile, auth_headers, make_client_profile
):
    """`user_id` is a unique 1:1 "guest client converted to login" link, not
    a general ownership marker -- it can be set on at most one client per
    user, so it cannot be used to seed multiple "owned" clients. This
    confirms the correct fix for the ownership-filter bug (see
    test_freelancer_can_list_their_own_clients) really does need to be
    filtering on freelancer_id: with 5 clients owned by this freelancer,
    pagination should slice across all 5."""
    for i in range(5):
        await make_client_profile(
            freelancer_id=freelancer_profile.id,
            name=f"Client {i}",
            email=f"client{i}@paged.com",
        )

    page1 = await client.get(f"{CLIENTS_URL}?skip=0&limit=2", headers=auth_headers)
    assert page1.status_code == 200
    body1 = page1.json()
    assert body1["total"] == 5
    assert len(body1["clients"]) == 2


async def test_client_list_search_by_name(
    client, user, freelancer_profile, auth_headers, make_client_profile
):
    await make_client_profile(
        freelancer_id=freelancer_profile.id, name="Findable Fox", email="fox@search.com"
    )
    await make_client_profile(
        freelancer_id=freelancer_profile.id, name="Other Company", email="other@search.com"
    )

    resp = await client.get(f"{CLIENTS_URL}?search=Findable", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["clients"][0]["name"] == "Findable Fox"


async def test_client_in_list_company_field_should_reflect_company_name(
    client, user, freelancer_profile, auth_headers, make_client_profile
):
    """ClientInList declares a `company` field but the ORM column is
    `company_name`; from_attributes silently swallows the missing attribute
    lookup (falls back to the field's default) so `company` always
    serializes as null, even when company_name is set.
    Bug: app/schemas/ClientsSchema.py ClientInList.company should either be
    named `company_name` or use `Field(alias="company_name")`."""
    await make_client_profile(
        freelancer_id=freelancer_profile.id,
        name="Has A Company",
        email="hascompany@example.com",
        company_name="Big Corp Inc",
        user_id=user.id,
    )

    resp = await client.get(CLIENTS_URL, headers=auth_headers)
    body = resp.json()
    assert body["clients"][0]["company"] == "Big Corp Inc"


async def test_cannot_access_another_freelancers_client(
    client, auth_headers, other_user, db_session, make_client_profile
):
    await db_session.refresh(other_user, attribute_names=["freelancer"])
    other_client = await make_client_profile(
        freelancer_id=other_user.freelancer.id,
        name="Not Yours",
        email="notyours@example.com",
        user_id=other_user.id,
    )

    get_resp = await client.get(f"{CLIENTS_URL}/{other_client.id}", headers=auth_headers)
    assert get_resp.status_code == 404

    patch_resp = await client.patch(
        f"{CLIENTS_URL}/{other_client.id}", json={"name": "Hijacked"}, headers=auth_headers
    )
    assert patch_resp.status_code == 404

    delete_resp = await client.delete(f"{CLIENTS_URL}/{other_client.id}", headers=auth_headers)
    assert delete_resp.status_code == 404


async def test_limit_query_param_is_bounded(client, auth_headers):
    too_big = await client.get(f"{CLIENTS_URL}?limit=101", headers=auth_headers)
    assert too_big.status_code == 422

    too_small = await client.get(f"{CLIENTS_URL}?limit=0", headers=auth_headers)
    assert too_small.status_code == 422
