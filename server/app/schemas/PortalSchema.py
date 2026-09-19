import uuid
from typing import Optional

from app.models.Project import ProjectStatus

from .Base import Base
from .types import UTCDateTime


class PortalProjectResponse(Base):
    """What a client may see of a project: deliberately excludes internal
    figures such as the freelancer's hourly rate and tracked time."""

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    status: ProjectStatus
    due_date: Optional[UTCDateTime] = None
    currency: Optional[str] = None
