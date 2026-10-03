from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from .Base import Base


class TaxInput(Base):
    """A tax to apply (any regime: VAT, GST, sales tax, withholding...)."""

    name: str = Field(min_length=1, max_length=100)
    rate: Decimal = Field(ge=0, le=100, max_digits=7, decimal_places=4,
                          description="Percent (15 == 15%).")
    is_inclusive: bool = Field(
        default=False, description="Prices already include this tax."
    )
    is_compound: bool = Field(
        default=False, description="Applied on the net plus earlier exclusive taxes."
    )
    is_withholding: bool = Field(
        default=False, description="Deducted from what the client pays."
    )


class TaxLineResponse(Base):
    name: str
    rate: Decimal
    amount: Decimal
    is_inclusive: bool
    is_compound: bool
    is_withholding: bool
