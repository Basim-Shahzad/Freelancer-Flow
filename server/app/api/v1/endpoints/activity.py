from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.v1.openapi import errors
from app.db.crud.activity import list_activity
from app.db.database import get_db
from app.models.User import User
from app.schemas.ActivitySchema import ActivityListResponse

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get(
    "",
    response_model=ActivityListResponse,
    summary="Activity feed",
    description="Newest first, cursor-paginated. Answers \"what changed since Monday\": each event "
    "carries the before/after values in `changes`. Scoped to the caller.",
    responses=errors(401),
)
async def get_activity_feed(
    date_from: datetime | None = Query(
        None, alias="from", description="Only events at or after this time."
    ),
    date_to: datetime | None = Query(
        None, alias="to", description="Only events at or before this time."
    ),
    entity_type: str | None = Query(
        None,
        max_length=50,
        description="e.g. project, milestone, invoice, time_entry, expense, client",
    ),
    entity_id: uuid.UUID | None = Query(None),
    cursor: str | None = Query(
        None, description="`next_cursor` from the previous page."
    ),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events, total, next_cursor = await list_activity(
        db,
        current_user.id,
        date_from=date_from,
        date_to=date_to,
        entity_type=entity_type,
        entity_id=entity_id,
        cursor=cursor,
        limit=limit,
    )
    return ActivityListResponse(events=events, total=total, next_cursor=next_cursor)
