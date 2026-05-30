from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional

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


class ClientListResponse(Base):
    clients: list[ClientResponse]
    total: int
