"""ISO-4217 currencies and their minor-unit exponents.

Only the exponent matters to the app (how many decimals an amount is rounded
to); it is the single source of truth for both validation and rounding.
Currencies not listed with a special exponent have 2.
"""

from __future__ import annotations

_ZERO_DECIMAL = "BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF"
_THREE_DECIMAL = "BHD IQD JOD KWD LYD OMR TND"
_FOUR_DECIMAL = "CLF UYW"
_TWO_DECIMAL = (
    "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BRL BSD "
    "BTN BWP BYN BZD CAD CDF CHF CNY COP CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB "
    "EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HTG HUF IDR ILS INR IRR JMD "
    "KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU "
    "MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR "
    "RON RSD RUB SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB "
    "TJS TMT TOP TRY TTD TWD TZS UAH USD UYU UZS VES WST XCD YER ZAR ZMW ZWG"
)

CURRENCY_EXPONENTS: dict[str, int] = {
    **{c: 0 for c in _ZERO_DECIMAL.split()},
    **{c: 3 for c in _THREE_DECIMAL.split()},
    **{c: 4 for c in _FOUR_DECIMAL.split()},
    **{c: 2 for c in _TWO_DECIMAL.split()},
}

# Highest exponent any supported currency uses; storage precision follows it.
MAX_EXPONENT = max(CURRENCY_EXPONENTS.values())


def is_valid_currency(code: str) -> bool:
    return code in CURRENCY_EXPONENTS


def currency_exponent(code: str | None) -> int:
    """Minor-unit digits for ``code``; 2 when unknown/absent (the common case)."""
    if code is None:
        return 2
    return CURRENCY_EXPONENTS.get(code.upper(), 2)
