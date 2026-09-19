"""Shared OpenAPI response documentation for the v1 routers."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    detail: str


_DESCRIPTIONS = {
    400: "Bad request",
    401: "Missing, invalid or expired credentials",
    403: "Authenticated but not allowed (e.g. no freelancer profile)",
    404: "Resource not found (also returned for resources owned by someone else)",
    409: "Conflict with the current state of the resource",
    422: "Validation error",
    429: "Too many requests",
}


def errors(*codes: int) -> dict[int | str, dict[str, Any]]:
    """Build a ``responses=`` mapping documenting the given error codes.

    422 keeps FastAPI's own detailed validation schema, so it is only listed
    for endpoints that also raise business-rule 422s.
    """
    out: dict[int | str, dict[str, Any]] = {}
    for code in codes:
        entry: dict[str, Any] = {"description": _DESCRIPTIONS[code]}
        if code != 422:
            entry["model"] = ErrorResponse
        out[code] = entry
    return out
