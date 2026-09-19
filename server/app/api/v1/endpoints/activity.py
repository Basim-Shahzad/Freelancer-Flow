from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.v1.openapi import errors
from app.db.crud.activity import list_activity
from app.db.database import get_db
from app.models.User import User
from app.schemas.ActivitySchema import ActivityListResponse
from app.schemas.types import UTCDateTime

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get(
    "",
    response_model=ActivityListResponse,
    summary="Activity feed",
    description="Newest first. Answers \"what changed since Monday\": each event "
    "carries the before/after values in `changes`. Scoped to the caller.",
    responses=errors(401),
)
async def get_activity_feed(
    since: Optional[datetime] = Query(None, description="Only events at or after this time."),
    entity_type: Optional[str] = Query(
        None,
        max_length=50,
        description="e.g. project, milestone, invoice, time_entry, expense, client",
    ),
    entity_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events, total = await list_activity(
        db,
        current_user.id,
        since=since,
        entity_type=entity_type,
        entity_id=entity_id,
        skip=skip,
        limit=limit,
    )
    return ActivityListResponse(events=events, total=total)
