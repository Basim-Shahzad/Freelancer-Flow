from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status


def resolve_currency(*candidates: Optional[str]) -> str:
    """First non-empty currency; 422 if none (the app assumes no default)."""
    for code in candidates:
        if code:
            return code
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail="No currency: set one on your profile or pass `currency` explicitly",
    )
