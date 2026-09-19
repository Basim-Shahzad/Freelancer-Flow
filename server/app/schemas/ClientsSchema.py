from __future__ import annotations
from pydantic import ConfigDict, EmailStr, Field
import uuid
from datetime import datetime
from typing import Optional
from .ProjectsSchema import ProjectResponse

from .Base import Base
from .types import CurrencyCode


class ClientCreate(Base):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    currency: Optional[CurrencyCode] = None


class ClientUpdate(Base):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0, le=365)
    currency: Optional[CurrencyCode] = None


class ClientResponse(Base):
    id: uuid.UUID
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
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
    company: Optional[str] = Field(default=None, validation_alias="company_name")
    tax_id: Optional[str] = None
    created_at: datetime
    projects: list[ProjectInClientList] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class ClientListResponse(Base):
    clients: list[ClientInList]
    total: int
