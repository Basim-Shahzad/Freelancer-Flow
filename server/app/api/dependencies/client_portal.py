from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.portal_tokens import validate_portal_token
from app.db.database import get_db
from app.models.ClientProfile import ClientProfile
from app.models.PortalAccessToken import PortalAccessToken


@dataclass
class PortalSession:
    client: ClientProfile
    token: PortalAccessToken


def _extract_token_str(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1]

    token_str = request.query_params.get("token")
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing portal token"
        )
    return token_str


async def get_portal_session(
    request: Request, db: AsyncSession = Depends(get_db)
) -> PortalSession:
    """Resolves and validates the portal token exactly once per request,
    returning both the Client and the underlying token row so routes can
    enforce scope without re-parsing or re-validating anything."""
    token_str = _extract_token_str(request)
    token_record = await validate_portal_token(
        db, token_str
    )  # raises on invalid/expired/revoked

    client = await db.get(ClientProfile, token_record.client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    return PortalSession(client=client, token=token_record)
