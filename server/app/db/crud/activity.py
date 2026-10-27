from __future__ import annotations

import base64
import binascii
import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Unprocessable
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


# Secrets: the audit feed records that they changed, never the values. This is
# the single redaction list; ``log_activity`` applies it to every ``changes``
# payload, so hand-built dicts are covered as well as ``diff_changes`` output.
REDACTED_FIELDS = frozenset(
    {
        # encrypted columns
        "tax_id",
        "tax_registration_number",
        "details",
        # credentials and tokens
        "password",
        "hashed_password",
        "token",
        "refresh_token",
        "access_token",
        "jti",
    }
)
REDACTED = "[redacted]"


def redact_changes(changes: dict[str, Any] | None) -> dict[str, Any] | None:
    """Copy of ``changes`` with the values of secret fields masked (nested too)."""
    if not changes:
        return changes

    def walk(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                k: (
                    {"old": REDACTED, "new": REDACTED}
                    if k in REDACTED_FIELDS
                    else walk(v)
                )
                for k, v in value.items()
            }
        if isinstance(value, list):
            return [walk(v) for v in value]
        return value

    return walk(changes)


def diff_changes(obj: Any, new_values: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Before/after pairs for the fields in ``new_values`` that really change.

    Call *before* applying ``new_values`` to ``obj``.
    """
    changes: dict[str, dict[str, Any]] = {}
    for field, new in new_values.items():
        old = getattr(obj, field, None)
        if not _same(old, new):
            if field in REDACTED_FIELDS:
                changes[field] = {"old": REDACTED, "new": REDACTED}
            else:
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
    changes: dict[str, Any] | None = None,
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
            changes=redact_changes(changes) or None,
        )
    )


def _encode_cursor(event: ActivityEvent) -> str:
    raw = f"{event.created_at.isoformat()}|{event.id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        stamp, id_ = raw.split("|")
        return datetime.fromisoformat(stamp), uuid.UUID(id_)
    except (ValueError, UnicodeDecodeError, binascii.Error):
        raise Unprocessable("Invalid cursor")


async def list_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    cursor: str | None = None,
    limit: int = 50,
) -> tuple[list[ActivityEvent], int, str | None]:
    """Newest first, ordered by ``(created_at, id)``; returns (page, total, next cursor)."""
    filters = [ActivityEvent.user_id == user_id]
    if date_from is not None:
        filters.append(ActivityEvent.created_at >= date_from)
    if date_to is not None:
        filters.append(ActivityEvent.created_at <= date_to)
    if entity_type:
        filters.append(ActivityEvent.entity_type == entity_type)
    if entity_id:
        filters.append(ActivityEvent.entity_id == entity_id)

    total = (
        await db.execute(select(func.count(ActivityEvent.id)).where(*filters))
    ).scalar_one()

    page_filters = list(filters)
    if cursor:
        stamp, last_id = _decode_cursor(cursor)
        page_filters.append(
            or_(
                ActivityEvent.created_at < stamp,
                and_(ActivityEvent.created_at == stamp, ActivityEvent.id < last_id),
            )
        )
    rows = list(
        (
            await db.execute(
                select(ActivityEvent)
                .where(*page_filters)
                .order_by(ActivityEvent.created_at.desc(), ActivityEvent.id.desc())
                .limit(limit + 1)
            )
        ).scalars()
    )
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = _encode_cursor(rows[-1])
    return rows, total, next_cursor
