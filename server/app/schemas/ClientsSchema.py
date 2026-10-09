from __future__ import annotations
from pydantic import ConfigDict, EmailStr, Field, field_serializer, field_validator
import uuid
from datetime import datetime
from typing import Optional
from .ProjectsSchema import ProjectResponse

from .Base import Base
from app.core.sensitive import mask
from app.services.phone import normalize_whatsapp

from .types import CurrencyCode


def _whatsapp_validator(cls, value: Optional[str]) -> Optional[str]:
    return normalize_whatsapp(value)


class ClientCreate(Base):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    currency: Optional[CurrencyCode] = None

    _normalize_whatsapp = field_validator("whatsapp_number")(_whatsapp_validator)


class ClientUpdate(Base):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    currency: Optional[CurrencyCode] = None

    _normalize_whatsapp = field_validator("whatsapp_number")(_whatsapp_validator)


class ClientResponse(Base):
    id: uuid.UUID
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None
    payment_terms_days: Optional[int] = None
    currency: Optional[str] = None
    user_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class ProjectInClientList(Base):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientInList(Base):
    id: uuid.UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    company:Optional[str] = Field(default=None, validation_alias="company_name")
    tax_id: Optional[str] = None
    created_at: datetime
    projects: list[ProjectInClientList] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("tax_id")
    def _mask_tax_id(self, value: Optional[str]) -> Optional[str]:
        # Lists show only the last digits; the full value is on the detail view.
        return mask(value)

class ClientListResponse(Base):
    clients: list[ClientInList]
    total: int
