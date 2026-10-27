from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import ConfigDict, EmailStr, Field, field_serializer, field_validator

from app.core.sensitive import mask
from app.services.phone import normalize_whatsapp

from .Base import Base
from .types import CurrencyCode


def _whatsapp_validator(cls, value: str | None) -> str | None:
    return normalize_whatsapp(value)


class ClientCreate(Base):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company_name: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    address: str | None = None
    tax_id: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    currency: CurrencyCode | None = None

    _normalize_whatsapp = field_validator("whatsapp_number")(_whatsapp_validator)


class ClientUpdate(Base):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    company_name: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    address: str | None = None
    tax_id: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    currency: CurrencyCode | None = None

    _normalize_whatsapp = field_validator("whatsapp_number")(_whatsapp_validator)


class ClientResponse(Base):
    id: uuid.UUID
    name: str
    email: str | None = None
    company_name: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    address: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    payment_terms_days: int | None = None
    currency: str | None = None
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
    email: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    company:str | None = Field(default=None, validation_alias="company_name")
    tax_id: str | None = None
    created_at: datetime
    projects: list[ProjectInClientList] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("tax_id")
    def _mask_tax_id(self, value: str | None) -> str | None:
        # Lists show only the last digits; the full value is on the detail view.
        return mask(value)

class ClientListResponse(Base):
    clients: list[ClientInList]
    total: int
