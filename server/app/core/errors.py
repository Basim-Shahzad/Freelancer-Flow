"""Domain errors raised by the data/service layer.

They carry an HTTP status so a single handler in ``app.main`` can render them
as ``{"detail": ...}``, the same shape FastAPI uses for ``HTTPException``,
while the code raising them stays free of FastAPI and usable from jobs or
scripts.
"""

from __future__ import annotations


class DomainError(Exception):
    status_code: int = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class BadRequest(DomainError):
    status_code = 400


class Unauthorized(DomainError):
    status_code = 401


class Forbidden(DomainError):
    status_code = 403


class NotFound(DomainError):
    status_code = 404


class Conflict(DomainError):
    status_code = 409


class Unprocessable(DomainError):
    status_code = 422


class RateLimited(DomainError):
    status_code = 429
