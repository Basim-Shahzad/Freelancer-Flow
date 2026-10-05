from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies.auth import AdminUser, DBSession
from app.api.v1.openapi import errors
from app.db.crud import reference as crud
from app.schemas.ReferenceSchema import ReferenceSettingOut, ReferenceSettingUpdate
from app.services import fx_fetch

router = APIRouter(prefix="/admin/reference", tags=["Reference data"])


@router.get(
    "",
    response_model=list[ReferenceSettingOut],
    summary="List reference settings",
    responses=errors(401, 403),
)
async def list_reference_settings(db: DBSession, admin: AdminUser):
    return await crud.list_settings(db)


# Declared before "/{key}" so "exchange_rates/refresh" is never read as a key.
@router.post(
    "/exchange_rates/refresh",
    response_model=ReferenceSettingOut,
    summary="Fetch exchange rates now",
    description="Forces a fetch from the rate provider and clears the manual "
    "override. Rates are display-only reference data.",
    responses=errors(400, 401, 403),
)
async def refresh_exchange_rates(db: DBSession, admin: AdminUser):
    await fx_fetch.refresh_now(db, admin)
    return await crud.get_setting(db, crud.EXCHANGE_RATES)


@router.get(
    "/{key}",
    response_model=ReferenceSettingOut,
    summary="Get a reference setting",
    responses=errors(401, 403, 404),
)
async def get_reference_setting(key: str, db: DBSession, admin: AdminUser):
    return await crud.get_setting(db, key)


@router.put(
    "/{key}",
    response_model=ReferenceSettingOut,
    summary="Override a reference setting",
    description="Emergency override. Saving `exchange_rates` freezes automatic "
    "refresh (`manual_override`) until an admin calls the refresh endpoint.",
    responses=errors(401, 403, 404, 422),
)
async def put_reference_setting(
    key: str, body: ReferenceSettingUpdate, db: DBSession, admin: AdminUser
):
    value = dict(body.value)
    if key == crud.EXCHANGE_RATES:
        value["manual_override"] = True
    return await crud.set_setting(
        db,
        key,
        value,
        reference_date=body.reference_date,
        user=admin,
        notes=body.notes,
    )
