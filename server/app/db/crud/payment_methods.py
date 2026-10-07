"""Freelancer payment-method configs.

Details (IBANs, wallet numbers) are encrypted at rest and never written to the
audit feed. Paylancer only displays them; it never moves money.
"""

from __future__ import annotations

import json
import uuid
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound, Unprocessable
from app.db.crud.activity import log_activity
from app.db.crud.reference import get_esfca_purpose_of_payment
from app.models.FreelancerProfile import FreelancerProfile
from app.models.InvoicePaymentMethod import InvoicePaymentMethod
from app.models.PaymentMethodConfig import PaymentMethodConfig, PaymentMethodType
from app.schemas.PaymentMethodSchema import (
    PaymentMethodCreate,
    PaymentMethodUpdate,
    validate_details,
)

_ENTITY = "payment_method"


async def _with_defaults(db: AsyncSession, type_: PaymentMethodType, details: dict) -> dict:
    if type_ == PaymentMethodType.ESFCA_WIRE and not details.get("purposeOfPayment"):
        details = {**details, "purposeOfPayment": await get_esfca_purpose_of_payment(db)}
    return details


def _validated(type_: PaymentMethodType, details: dict) -> dict:
    try:
        return validate_details(type_, details)
    except ValueError as exc:
        raise Unprocessable(f"details: {exc}")


async def get_method_by_id(
    db: AsyncSession, method_id: uuid.UUID, freelancer_id: uuid.UUID
) -> PaymentMethodConfig:
    method = (
        await db.execute(
            select(PaymentMethodConfig).where(
                PaymentMethodConfig.id == method_id,
                PaymentMethodConfig.freelancer_id == freelancer_id,
            )
        )
    ).scalar_one_or_none()
    if method is None:
        raise NotFound("Payment method not found")
    return method


async def list_methods(
    db: AsyncSession, freelancer_id: uuid.UUID, *, include_inactive: bool = True
) -> list[PaymentMethodConfig]:
    query = select(PaymentMethodConfig).where(
        PaymentMethodConfig.freelancer_id == freelancer_id
    )
    if not include_inactive:
        query = query.where(PaymentMethodConfig.is_active.is_(True))
    rows = await db.execute(
        query.order_by(PaymentMethodConfig.sort_order, PaymentMethodConfig.created_at)
    )
    return list(rows.scalars().all())


async def create_method(
    db: AsyncSession, data: PaymentMethodCreate, freelancer: FreelancerProfile
) -> PaymentMethodConfig:
    details = await _with_defaults(db, data.type, data.details)
    existing = await list_methods(db, freelancer.id)
    next_order = max((m.sort_order for m in existing), default=-1) + 1
    # The first method a freelancer adds is on new invoices by default.
    is_default = data.is_default or not any(m.is_active for m in existing)

    method = PaymentMethodConfig(
        freelancer_id=freelancer.id,
        type=data.type,
        label=data.label,
        currency=data.currency,
        details=json.dumps(details),
        is_default=is_default,
        is_active=True,
        sort_order=next_order,
    )
    db.add(method)
    await db.flush()
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type=_ENTITY,
        entity_id=method.id,
        action="created",
        summary=f"Added payment method {method.label} ({method.type.value})",
        changes={"details": {"old": None, "new": "[redacted]"}},
    )
    await db.commit()
    await db.refresh(method)
    return method


async def update_method(
    db: AsyncSession,
    method_id: uuid.UUID,
    data: PaymentMethodUpdate,
    freelancer: FreelancerProfile,
) -> PaymentMethodConfig:
    method = await get_method_by_id(db, method_id, freelancer.id)
    patch = data.model_dump(exclude_unset=True)
    for required in ("label", "is_default", "is_active", "details"):
        if required in patch and patch[required] is None:
            raise Unprocessable(f"{required} cannot be null")

    changes: dict[str, dict] = {}

    def apply(field: str, new) -> None:
        old = getattr(method, field)
        if old != new:
            changes[field] = {"old": old, "new": new}
            setattr(method, field, new)

    for field in ("label", "currency", "is_default", "is_active"):
        if field in patch:
            apply(field, patch[field])
    if "details" in patch:
        details = _validated(method.type, patch["details"])
        details = await _with_defaults(db, method.type, details)
        serialized = json.dumps(details)
        if serialized != method.details:
            changes["details"] = {"old": "[redacted]", "new": "[redacted]"}
            method.details = serialized
    # A retired method is never on new invoices by default.
    if not method.is_active and method.is_default:
        apply("is_default", False)

    if changes:
        log_activity(
            db,
            user_id=freelancer.user_id,
            entity_type=_ENTITY,
            entity_id=method.id,
            action="updated",
            summary=f"Updated payment method {method.label}",
            changes=changes,
        )
    await db.commit()
    await db.refresh(method)
    return method


async def delete_method(
    db: AsyncSession, method_id: uuid.UUID, freelancer: FreelancerProfile
) -> None:
    # Hard delete is safe: invoice snapshots are self-contained copies. Their
    # `source_method_id` is SET NULL by the FK; we also do it explicitly so it
    # holds on databases that don't enforce FKs. Use `is_active=false` to retire.
    method = await get_method_by_id(db, method_id, freelancer.id)
    await db.execute(
        update(InvoicePaymentMethod)
        .where(InvoicePaymentMethod.source_method_id == method.id)
        .values(source_method_id=None)
    )
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type=_ENTITY,
        entity_id=method.id,
        action="deleted",
        summary=f"Deleted payment method {method.label} ({method.type.value})",
    )
    await db.delete(method)
    await db.commit()


async def reorder_methods(
    db: AsyncSession, ids: list[uuid.UUID], freelancer: FreelancerProfile
) -> list[PaymentMethodConfig]:
    methods = await list_methods(db, freelancer.id)
    if len(set(ids)) != len(ids) or set(ids) != {m.id for m in methods}:
        raise Unprocessable("ids must list each of your payment methods exactly once")
    by_id = {m.id: m for m in methods}
    for position, method_id in enumerate(ids):
        by_id[method_id].sort_order = position
    log_activity(
        db,
        user_id=freelancer.user_id,
        entity_type=_ENTITY,
        entity_id=ids[0],
        action="reordered",
        summary="Reordered payment methods",
    )
    await db.commit()
    return await list_methods(db, freelancer.id)
