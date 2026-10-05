"""Reference-data store (exchange rates, provider wording).

Money Rule: exchange rates kept here are display-only. They are never used in
totals and never stored on invoices or payments.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound, Unprocessable
from app.db.crud.activity import diff_changes, log_activity
from app.models.ReferenceSetting import ReferenceSetting
from app.models.User import User
from app.schemas.ReferenceSchema import ExchangeRatesValue, PaymentTextsValue

logger = logging.getLogger(__name__)

EXCHANGE_RATES = "exchange_rates"
PAYMENT_TEXTS = "payment_texts"

_VALUE_MODELS = {
    EXCHANGE_RATES: ExchangeRatesValue,
    PAYMENT_TEXTS: PaymentTextsValue,
}

DEFAULTS: dict[str, dict[str, Any]] = {
    PAYMENT_TEXTS: {
        "esfca_purpose_of_payment": "Payment for IT / software services export"
    },
    EXCHANGE_RATES: {
        "base": "USD",
        "rates": {},
        "as_of": None,
        "source": None,
        "fetched_at": None,
        "manual_override": False,
    },
}


def validate_value(key: str, value: dict[str, Any]) -> dict[str, Any]:
    """Validate ``value`` against the key's shape and return its JSON form."""
    model = _VALUE_MODELS.get(key)
    if model is None:
        return value
    try:
        return model.model_validate(value).model_dump(mode="json")
    except ValidationError as exc:
        raise Unprocessable(
            "; ".join(
                f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()
            )
        )


async def list_settings(db: AsyncSession) -> list[ReferenceSetting]:
    rows = await db.execute(select(ReferenceSetting).order_by(ReferenceSetting.key))
    return list(rows.scalars().all())


async def find_setting(db: AsyncSession, key: str) -> Optional[ReferenceSetting]:
    return (
        await db.execute(select(ReferenceSetting).where(ReferenceSetting.key == key))
    ).scalar_one_or_none()


async def get_setting(db: AsyncSession, key: str) -> ReferenceSetting:
    setting = await find_setting(db, key)
    if setting is None:
        raise NotFound("Reference setting not found")
    return setting


async def set_setting(
    db: AsyncSession,
    key: str,
    value: dict[str, Any],
    reference_date: Optional[date] = None,
    user: Optional[User] = None,
    notes: Optional[str] = None,
) -> ReferenceSetting:
    """Update an existing setting and commit.

    ``user=None`` means the system fetcher: the row records ``updated_by=NULL``
    and nothing is added to the per-user audit feed.
    """
    setting = await get_setting(db, key)
    value = validate_value(key, value)

    if user is not None:
        log_activity(
            db,
            user_id=user.id,
            entity_type="reference_setting",
            entity_id=setting.id,
            action="update",
            summary=f"Updated reference setting {key}",
            changes=diff_changes(
                setting,
                {"value": value, "reference_date": reference_date, "notes": notes},
            ),
        )
    else:
        logger.info("Reference setting %s updated by the system", key)

    setting.value = value
    setting.reference_date = reference_date
    setting.notes = notes
    setting.updated_by = user.id if user is not None else None
    await db.commit()
    await db.refresh(setting)
    return setting


async def seed_reference_settings(db: AsyncSession) -> None:
    """Insert missing default settings. Idempotent; never overwrites."""
    existing = {s.key for s in await list_settings(db)}
    for key, value in DEFAULTS.items():
        if key not in existing:
            db.add(ReferenceSetting(key=key, value=value))
    await db.commit()


async def get_payment_texts(db: AsyncSession) -> PaymentTextsValue:
    setting = await find_setting(db, PAYMENT_TEXTS)
    return PaymentTextsValue.model_validate(
        setting.value if setting else DEFAULTS[PAYMENT_TEXTS]
    )


async def get_esfca_purpose_of_payment(db: AsyncSession) -> str:
    return (await get_payment_texts(db)).esfca_purpose_of_payment
