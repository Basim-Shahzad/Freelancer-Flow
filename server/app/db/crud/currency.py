from __future__ import annotations

from app.core.errors import Unprocessable


def resolve_currency(*candidates: str | None) -> str:
    """First non-empty currency; 422 if none (the app assumes no default)."""
    for code in candidates:
        if code:
            return code
    raise Unprocessable(
        "No currency: set one on your profile or pass `currency` explicitly"
    )
