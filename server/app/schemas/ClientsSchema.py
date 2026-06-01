from __future__ import annotations
from pydantic import ConfigDict, Field
import uuid
from datetime import datetime
from typing import Optional
from .ProjectsSchema import ProjectResponse

from .Base import Base


class ClientCreate(Base):
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(Base):
    name: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None


class ClientResponse(Base):
    id: uuid.UUID
    name: str
    email: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    notes: Optional[str] = None
    user_id: uuid.UUID
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
    company: Optional[str] = None
    tax_id: Optional[str] = None
    created_at: datetime
    projects: list[ProjectInClientList] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class ClientListResponse(Base):
    clients: list[ClientInList]
    total: int
