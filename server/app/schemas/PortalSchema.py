import uuid
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.Project import ProjectStatus

from .Base import Base
from .InvoiceSchema import InvoiceResponse
from .ReferenceSchema import PublicExchangeRates
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


class PortalConvertRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # Same rules as registration (see AuthSchema.UserCreate).
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class PortalInvoiceResponse(InvoiceResponse):
    """Portal visitors have no account, so the rates ride along with the invoice
    for the client's display-only estimate (Money Rule)."""

    exchange_rates: Optional[PublicExchangeRates] = None
