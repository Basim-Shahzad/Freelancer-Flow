import uuid
from typing import Any, Optional

from .Base import Base
from .types import UTCDateTime


class ActivityEventResponse(Base):
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    action: str
    summary: str
    changes: Optional[dict[str, Any]] = None
    created_at: UTCDateTime


class ActivityListResponse(Base):
    events: list[ActivityEventResponse]
    total: int
