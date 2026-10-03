import uuid
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.crud.portal_tokens import validate_portal_token
from app.db.database import get_db
from app.models.ClientProfile import ClientProfile
from app.models.PortalAccessToken import PortalAccessToken, ScopeType


async def get_portal_client(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_query: Optional[str] = Query(None, alias="token"),
    authorization: Optional[str] = Header(None),
) -> ClientProfile:
    # 1. Extract token string (Query param or Bearer header)
    token_str: Optional[str] = None
    if token_query:
        token_str = token_query
    elif authorization and authorization.lower().startswith("bearer "):
        token_str = authorization.split(" ", 1)[1]

    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    # 2. Validate JWT and database token record
    token_record: PortalAccessToken = await validate_portal_token(db, token_str)

    # 3. Path parameter scope validation
    path_params = request.path_params
    project_id: Optional[str] = path_params.get("project_id")
    milestone_id: Optional[str] = path_params.get("milestone_id")

    if project_id:
        try:
            req_project_uuid = uuid.UUID(project_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project_id UUID"
            )

        if token_record.scope_type != ScopeType.PROJECT or token_record.scope != req_project_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token scope does not match requested project",
            )

    if milestone_id:
        try:
            req_milestone_uuid = uuid.UUID(milestone_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid milestone_id UUID"
            )

        if token_record.scope_type != ScopeType.MILESTONE or token_record.scope != req_milestone_uuid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token scope does not match requested milestone",
            )

    # 4. Resolve and return Client
    stmt = select(ClientProfile).where(ClientProfile.id == token_record.client_id)
    result = await db.execute(stmt)
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Associated client account not found",
        )

    return client
