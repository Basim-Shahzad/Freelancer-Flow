import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status, Request, Depends, Query, Header
from app.core.config import settings
from app.db.database import get_db

from app.models.PortalAccessToken import PortalAccessToken, ScopeType
from app.models.ClientProfile import ClientProfile


async def issue_portal_token(
    db: AsyncSession, client_id: uuid.UUID, scope_type: ScopeType, scope_id: uuid.UUID
) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=14)
    jti = str(uuid.uuid4())

    db_token = PortalAccessToken(
        jti=jti,
        client_id=client_id,
        scope_type=scope_type,
        scope=scope_id,
        issued_at=now,
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.commit()

    payload = {
        "client_id": str(client_id),
        "jti": jti,
        "scope_type": (
            scope_type.value if isinstance(scope_type, ScopeType) else scope_type
        ),
        "scope": str(scope_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def validate_portal_token(db: AsyncSession, token_string: str) -> PortalAccessToken:
    try:
        payload = jwt.decode(
            token_string, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token signature",
        )

    jti: Optional[str] = payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing JTI claim"
        )

    stmt = select(PortalAccessToken).where(PortalAccessToken.jti == jti)
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token record not found"
        )

    if token_record.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    now = datetime.now(timezone.utc)
    if token_record.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired"
        )

    return token_record


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
