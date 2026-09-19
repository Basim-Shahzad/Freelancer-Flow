import uuid
from typing import Optional

from pydantic import Field

from app.models.Payment import PaymentMethod

from .Base import Base
from .types import PositiveMoney, UTCDateTime


class PaymentCreate(Base):
    """POST /invoices/{id}/payments"""

    amount: PositiveMoney
    paid_at: Optional[UTCDateTime] = Field(
        default=None, description="Defaults to now. May not be in the future."
    )
    method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    reference: Optional[str] = Field(default=None, max_length=255)


class PaymentResponse(Base):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: PositiveMoney
    paid_at: UTCDateTime
    method: PaymentMethod
    reference: Optional[str] = None
    created_at: UTCDateTime
