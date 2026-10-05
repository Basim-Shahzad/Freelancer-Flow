"""Payment-method schemas.

The top-level ``type`` selects which ``*Details`` model validates ``details``
(``DETAILS_MODELS``). Validated details are normalized (IBANs upper-cased,
mobile numbers in +92 form, ...) and stored/returned in camelCase.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Callable, Literal, Optional

from pydantic import ConfigDict, EmailStr, Field, ValidationError, field_validator, model_validator

from app.core import bank_validators as bv
from app.models.PaymentMethodConfig import PaymentMethodType

from .Base import Base
from .types import ClientFacingText, CurrencyCode

AccountType = Literal["CHECKING", "SAVINGS"]


class _Details(Base):
    model_config = ConfigDict(
        alias_generator=Base.model_config["alias_generator"],
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


Name = ClientFacingText


class PayoneerDetails(_Details):
    account_email: Optional[EmailStr] = None
    payment_request_url: Optional[str] = Field(default=None, max_length=1024)
    bank_name: Optional[Name] = Field(default=None, max_length=255)
    account_holder: Optional[Name] = Field(default=None, max_length=255)
    iban: Optional[str] = None
    swift_bic: Optional[str] = None

    @field_validator("payment_request_url")
    @classmethod
    def _url(cls, v):
        return None if v is None else bv.validate_https_url(v)

    @field_validator("iban")
    @classmethod
    def _iban(cls, v):
        return None if v is None else bv.validate_iban(v)

    @field_validator("swift_bic")
    @classmethod
    def _bic(cls, v):
        return None if v is None else bv.validate_swift_bic(v)

    @model_validator(mode="after")
    def _needs_a_way_to_pay(self):
        if not self.account_email and not self.payment_request_url:
            raise ValueError("provide accountEmail and/or paymentRequestUrl")
        return self


class EsfcaWireDetails(_Details):
    beneficiary_name: Name = Field(min_length=1, max_length=255)
    bank_name: Name = Field(min_length=1, max_length=255)
    iban: str
    swift_bic: str
    bank_address: Name = Field(min_length=1, max_length=500)
    # Filled from the `payment_texts` reference setting when omitted (crud).
    purpose_of_payment: Optional[Name] = Field(default=None, max_length=255)

    @field_validator("iban")
    @classmethod
    def _iban(cls, v):
        return bv.validate_pk_iban(v)

    @field_validator("swift_bic")
    @classmethod
    def _bic(cls, v):
        return bv.validate_swift_bic(v)


class ElevatePayDetails(_Details):
    account_holder: Name = Field(min_length=1, max_length=255)
    account_number: str = Field(pattern=r"^\d{4,17}$")
    routing_number: str
    bank_name: Name = Field(min_length=1, max_length=255)
    account_type: AccountType

    @field_validator("routing_number")
    @classmethod
    def _aba(cls, v):
        return bv.validate_aba(v)


class WiseToIbanDetails(_Details):
    beneficiary_name: Name = Field(min_length=1, max_length=255)
    iban: str
    bank_name: Name = Field(min_length=1, max_length=255)
    note: Optional[Name] = Field(default=None, max_length=1000)

    @field_validator("iban")
    @classmethod
    def _iban(cls, v):
        return bv.validate_iban(v)


class PkrBankTransferDetails(_Details):
    account_title: Name = Field(min_length=1, max_length=255)
    bank_name: Name = Field(min_length=1, max_length=255)
    iban: str
    account_number: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9-]{4,34}$")

    @field_validator("iban")
    @classmethod
    def _iban(cls, v):
        return bv.validate_pk_iban(v)


class RaastDetails(_Details):
    account_title: Name = Field(min_length=1, max_length=255)
    raast_id: Optional[str] = Field(default=None, min_length=1, max_length=100)
    iban: Optional[str] = None

    @field_validator("iban")
    @classmethod
    def _iban(cls, v):
        return None if v is None else bv.validate_pk_iban(v)

    @model_validator(mode="after")
    def _needs_an_id(self):
        if not self.raast_id and not self.iban:
            raise ValueError("provide raastId or iban")
        return self


class _WalletDetails(_Details):
    mobile_number: str
    account_title: Name = Field(min_length=1, max_length=255)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v):
        return bv.normalize_pk_mobile(v)


class JazzCashDetails(_WalletDetails):
    pass


class EasypaisaDetails(_WalletDetails):
    pass


class OtherDetails(_Details):
    instructions: Name = Field(min_length=1, max_length=2000)


# ── Generic bank transfer: data-driven schemes ────────────────────────────────


def _digits(lo: int, hi: int) -> Callable[[str], str]:
    def check(v: str) -> str:
        v = re.sub(r"[\s-]", "", v)
        if not re.fullmatch(rf"\d{{{lo},{hi}}}", v):
            raise ValueError(f"must be {lo}-{hi} digits" if lo != hi else f"must be {lo} digits")
        return v

    return check


def _account_type(v: str) -> str:
    v = v.upper()
    if v not in ("CHECKING", "SAVINGS"):
        raise ValueError("must be CHECKING or SAVINGS")
    return v


class SchemeSpec:
    """Fields a scheme accepts: ``name -> normalizer``; ``required`` must be set."""

    def __init__(self, fields: dict[str, Callable[[str], str]], required: set[str]):
        self.fields = fields
        self.required = required


# Adding a scheme = adding one entry here (and the field to BankTransferDetails).
BANK_SCHEMES: dict[str, SchemeSpec] = {
    "IBAN": SchemeSpec(
        {"iban": bv.validate_iban, "swift_bic": bv.validate_swift_bic}, {"iban"}
    ),
    "ACH": SchemeSpec(
        {
            "routing_number": bv.validate_aba,
            "account_number": _digits(4, 17),
            "account_type": _account_type,
        },
        {"routing_number", "account_number", "account_type"},
    ),
    "UK_SORT_CODE": SchemeSpec(
        {"sort_code": bv.normalize_sort_code, "account_number": _digits(8, 8)},
        {"sort_code", "account_number"},
    ),
    "SWIFT_OTHER": SchemeSpec(
        {
            "account_number": lambda v: re.sub(r"\s", "", v),
            "swift_bic": bv.validate_swift_bic,
            "branch_code": lambda v: v.strip(),
        },
        {"account_number", "swift_bic"},
    ),
}
_ALL_SCHEME_FIELDS = {f for spec in BANK_SCHEMES.values() for f in spec.fields}


class BankTransferDetails(_Details):
    country: str = Field(pattern=r"^[A-Za-z]{2}$")
    account_holder: Name = Field(min_length=1, max_length=255)
    bank_name: Name = Field(min_length=1, max_length=255)
    currency: CurrencyCode
    bank_address: Optional[Name] = Field(default=None, max_length=500)
    reference_note: Optional[Name] = Field(default=None, max_length=500)
    scheme: Literal["IBAN", "ACH", "UK_SORT_CODE", "SWIFT_OTHER"]

    iban: Optional[str] = None
    swift_bic: Optional[str] = None
    routing_number: Optional[str] = None
    account_number: Optional[str] = None
    account_type: Optional[str] = None
    sort_code: Optional[str] = None
    branch_code: Optional[str] = Field(default=None, max_length=50)

    @field_validator("country")
    @classmethod
    def _country(cls, v):
        return v.upper()

    @model_validator(mode="after")
    def _scheme_rules(self):
        spec = BANK_SCHEMES[self.scheme]
        errors: list[str] = []
        for field in _ALL_SCHEME_FIELDS:
            value = getattr(self, field)
            if field not in spec.fields:
                if value is not None:
                    errors.append(f"{field} is not used by scheme {self.scheme}")
                continue
            if value is None or value == "":
                if field in spec.required:
                    errors.append(f"{field} is required for scheme {self.scheme}")
                setattr(self, field, None)
                continue
            try:
                if field == "iban":
                    setattr(self, field, bv.validate_iban(value, self.country))
                else:
                    setattr(self, field, spec.fields[field](value))
            except ValueError as exc:
                errors.append(f"{field}: {exc}")
        if errors:
            raise ValueError("; ".join(errors))
        return self


DETAILS_MODELS: dict[PaymentMethodType, type[_Details]] = {
    PaymentMethodType.PAYONEER: PayoneerDetails,
    PaymentMethodType.ESFCA_WIRE: EsfcaWireDetails,
    PaymentMethodType.ELEVATE_PAY: ElevatePayDetails,
    PaymentMethodType.WISE_TO_IBAN: WiseToIbanDetails,
    PaymentMethodType.PKR_BANK_TRANSFER: PkrBankTransferDetails,
    PaymentMethodType.RAAST: RaastDetails,
    PaymentMethodType.JAZZCASH: JazzCashDetails,
    PaymentMethodType.EASYPAISA: EasypaisaDetails,
    PaymentMethodType.BANK_TRANSFER: BankTransferDetails,
    PaymentMethodType.OTHER: OtherDetails,
}


def validate_details(
    type_: PaymentMethodType, details: dict[str, Any]
) -> dict[str, Any]:
    """Validate and normalize ``details`` for ``type_`` (camelCase JSON out).

    Raises ``ValueError`` (pydantic-compatible) with one message listing every problem.
    """
    try:
        model = DETAILS_MODELS[type_].model_validate(details)
    except ValidationError as exc:
        raise ValueError(
            "; ".join(
                f"{'.'.join(str(p) for p in e['loc']) or 'details'}: {e['msg'].removeprefix('Value error, ')}"
                for e in exc.errors()
            )
        )
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


# ── Request / response ────────────────────────────────────────────────────────


class PaymentMethodCreate(Base):
    """POST /payment-methods"""

    type: PaymentMethodType
    label: ClientFacingText = Field(min_length=1, max_length=100)
    currency: Optional[CurrencyCode] = None
    is_default: bool = False
    details: dict[str, Any]

    @model_validator(mode="after")
    def _details(self):
        self.details = validate_details(self.type, self.details)
        return self


class PaymentMethodUpdate(Base):
    """PATCH /payment-methods/{id}. ``type`` is immutable; ``details`` replaces wholesale."""

    label: Optional[ClientFacingText] = Field(default=None, min_length=1, max_length=100)
    currency: Optional[CurrencyCode] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    details: Optional[dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=Base.model_config["alias_generator"],
        populate_by_name=True,
        extra="forbid",
    )


class PaymentMethodResponse(Base):
    id: uuid.UUID
    type: PaymentMethodType
    label: str
    currency: Optional[str] = None
    is_default: bool
    is_active: bool
    sort_order: int
    details: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    @field_validator("details", mode="before")
    @classmethod
    def _parse_details(cls, v):
        # The column holds serialized (encrypted) JSON.
        return json.loads(v) if isinstance(v, str) else v


class PaymentMethodListResponse(Base):
    payment_methods: list[PaymentMethodResponse]


class PaymentMethodOrder(Base):
    ids: list[uuid.UUID] = Field(min_length=1)
