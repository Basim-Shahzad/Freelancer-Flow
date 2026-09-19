from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ActivityEvent import ActivityEvent


def _jsonable(value: Any) -> Any:
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _same(old: Any, new: Any) -> bool:
    if isinstance(old, datetime) and isinstance(new, datetime):
        return old.replace(tzinfo=None) == new.replace(tzinfo=None) if (
            old.tzinfo is None or new.tzinfo is None
        ) else old == new
    return old == new


def diff_changes(obj: Any, new_values: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Before/after pairs for the fields in ``new_values`` that really change.

    Call *before* applying ``new_values`` to ``obj``.
    """
    changes: dict[str, dict[str, Any]] = {}
    for field, new in new_values.items():
        old = getattr(obj, field, None)
        if not _same(old, new):
            changes[field] = {"old": _jsonable(old), "new": _jsonable(new)}
    return changes


def log_activity(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    summary: str,
    changes: Optional[dict[str, Any]] = None,
) -> None:
    """Stage an audit row in the caller's transaction (no commit).

    Committing together with the change itself guarantees the feed never
    disagrees with the data.
    """
    db.add(
        ActivityEvent(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            summary=summary[:255],
            changes=changes or None,
        )
    )


async def list_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    since: Optional[datetime] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[ActivityEvent], int]:
    filters = [ActivityEvent.user_id == user_id]
    if since is not None:
        filters.append(ActivityEvent.created_at >= since)
    if entity_type:
        filters.append(ActivityEvent.entity_type == entity_type)
    if entity_id:
        filters.append(ActivityEvent.entity_id == entity_id)

    total = (
        await db.execute(select(func.count(ActivityEvent.id)).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(ActivityEvent)
            .where(*filters)
            .order_by(ActivityEvent.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).scalars().all()
    return list(rows), total
