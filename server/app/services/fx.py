"""Pure currency conversion for *display only*. No I/O.

Money Rule: converted amounts are estimates. They are never stored and never
used in totals. Callers fetch the rates once (``fx_fetch.get_exchange_rates``)
and pass them in.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping, Optional

from app.services.invoicing import quantize_money

REFERENCE_NOTE = "Reference rate only; the actual rate is set by your bank or provider."

# The "other" currency shown next to an amount. Anything else shows nothing.
_COUNTERPART = {"USD": "PKR", "PKR": "USD"}


@dataclass(frozen=True)
class DisplayAmount:
    currency: str
    amount: Decimal
    rate: Decimal  # units of ``currency`` per 1 unit of the source currency
    as_of: Optional[date]
    source: Optional[str]
    is_estimate: bool = True


def display_currency_for(currency: Optional[str]) -> Optional[str]:
    return _COUNTERPART.get((currency or "").upper())


def _units_per_base(code: str, base: str, rates: Mapping[str, Any]) -> Optional[Decimal]:
    if code == base:
        return Decimal(1)
    raw = rates.get(code)
    if raw is None:
        return None
    try:
        rate = Decimal(str(raw))
    except InvalidOperation:
        return None
    return rate if rate.is_finite() and rate > 0 else None


def _parse_date(raw: Any) -> Optional[date]:
    if isinstance(raw, date):
        return raw
    try:
        return date.fromisoformat(str(raw))
    except (TypeError, ValueError):
        return None


def convert_for_display(
    amount: Decimal,
    from_ccy: str,
    to_ccy: str,
    rates: Mapping[str, Any],
) -> Optional[DisplayAmount]:
    """Estimate ``amount`` in ``to_ccy``; ``None`` when there is no rate.

    ``rates`` is the ``exchange_rates`` value: ``base`` plus ``rates`` as
    units of each currency per 1 ``base``. Direct, inverse and cross pairs all
    go through the base, so one formula covers them. Never guesses.
    """
    from_ccy, to_ccy = from_ccy.upper(), to_ccy.upper()
    if from_ccy == to_ccy:
        return None

    base = str(rates.get("base") or "USD").upper()
    table = {str(k).upper(): v for k, v in (rates.get("rates") or {}).items()}
    from_units = _units_per_base(from_ccy, base, table)
    to_units = _units_per_base(to_ccy, base, table)
    if from_units is None or to_units is None:
        return None

    rate = to_units / from_units
    return DisplayAmount(
        currency=to_ccy,
        amount=quantize_money(amount * rate, to_ccy),
        rate=rate,
        as_of=_parse_date(rates.get("as_of")),
        source=rates.get("source"),
    )
