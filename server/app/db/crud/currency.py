from __future__ import annotations

from typing import Optional

from app.core.errors import Unprocessable


def resolve_currency(*candidates: Optional[str]) -> str:
    """First non-empty currency; 422 if none (the app assumes no default)."""
    for code in candidates:
        if code:
            return code
    raise Unprocessable(
        "No currency: set one on your profile or pass `currency` explicitly"
    )
