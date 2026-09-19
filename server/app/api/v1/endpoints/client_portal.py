from __future__ import annotations
from uuid import UUID
from dataclasses import dataclass
from datetime import datetime, timezone

from typing import Optional

from fastapi import APIRouter, Body, Depends, status, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.v1.openapi import errors
from app.db.crud.activity import log_activity
from app.db.crud.invoices import mark_invoice_viewed
from app.db.database import get_db
from app.schemas.InvoiceSchema import InvoiceResponse
from app.schemas.MilestoneSchema import MilestoneDecision, MilestoneResponse
from app.schemas.PortalSchema import PortalProjectResponse
from app.api.dependencies.client_portal import validate_portal_token
from app.core.security import hash_password
from app.models.User import User
from app.models.ClientProfile import ClientProfile
from app.models.Project import Project
from app.models.Milestone import Milestone, MilestoneStatus
from app.models.MilestoneApproval import MilestoneApproval, MilestoneApprovalDecision
from app.models.PortalAccessToken import PortalAccessToken, ScopeType

router = APIRouter(prefix="/portal", tags=["Portal"])


# ---------------------------------------------------------------------------
# Shared token/session handling
# ---------------------------------------------------------------------------


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


def _require_project_scope(session: PortalSession, project_id: UUID) -> None:
    """Confirms the token was actually issued for this project, not just
    for this client in general. Without this, a token scoped to Project A
    would also work against Project B for the same client."""
    if session.token.scope_type != ScopeType.PROJECT or session.token.scope != project_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token is not valid for this project",
        )


async def _load_milestone_for_session(
    db: AsyncSession, milestone_id: UUID, session: PortalSession
) -> Milestone:
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.project.has(Project.client_id == session.client.id),
        )
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    # token is scoped by project, so check the milestone's project matches it
    _require_project_scope(session, milestone.project_id)
    return milestone


# ---------------------------------------------------------------------------
# Read-only views
# ---------------------------------------------------------------------------


@router.get(
    "/project/{project_id}",
    response_model=PortalProjectResponse,
    summary="View a project (client portal)",
    responses=errors(401, 403, 404),
)
async def get_portal_project(
    project_id: UUID,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    _require_project_scope(session, project_id)

    result = await db.execute(
        select(Project).where(
            Project.id == project_id, Project.client_id == session.client.id
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


@router.get(
    "/milestone/{milestone_id}",
    response_model=MilestoneResponse,
    summary="View a milestone (client portal)",
    responses=errors(401, 403, 404),
)
async def get_portal_milestone(
    milestone_id: UUID,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    return await _load_milestone_for_session(db, milestone_id, session)


# ---------------------------------------------------------------------------
# Approve / reject
# ---------------------------------------------------------------------------


@router.post(
    "/milestone/{milestone_id}/approve",
    response_model=MilestoneResponse,
    summary="Approve a submitted milestone",
    description="Optional `comment` is stored with the decision.",
    responses=errors(400, 401, 403, 404),
)
async def approve_portal_milestone(
    milestone_id: UUID,
    request: Request,
    data: Optional[MilestoneDecision] = Body(None),
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_milestone_decision(
        milestone_id,
        MilestoneApprovalDecision.APPROVED,
        session,
        request,
        db,
        comment=data.comment if data else None,
    )


@router.post(
    "/milestone/{milestone_id}/reject",
    response_model=MilestoneResponse,
    summary="Reject a submitted milestone",
    description="`comment` is required and should explain what needs to change; "
    "it is stored in the approval history.",
    responses=errors(400, 401, 403, 404, 422),
)
async def reject_portal_milestone(
    milestone_id: UUID,
    request: Request,
    data: Optional[MilestoneDecision] = Body(None),
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    return await _handle_milestone_decision(
        milestone_id,
        MilestoneApprovalDecision.REJECTED,
        session,
        request,
        db,
        comment=data.comment if data else None,
    )


@router.get(
    "/invoice/{invoice_id}",
    response_model=InvoiceResponse,
    summary="View an invoice (client portal)",
    description="Requires an invoice-scoped link. The first view stamps the "
    "invoice's `viewedAt` and logs a VIEWED event.",
    responses=errors(401, 403, 404),
)
async def get_portal_invoice(
    invoice_id: UUID,
    request: Request,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    if session.token.scope_type != ScopeType.INVOICE or session.token.scope != invoice_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token is not valid for this invoice",
        )
    return await mark_invoice_viewed(
        db,
        invoice_id,
        session.client.id,
        request.client.host if request.client else None,
    )


async def _handle_milestone_decision(
    milestone_id: UUID,
    decision: MilestoneApprovalDecision,
    session: PortalSession,
    request: Request,
    db: AsyncSession,
    comment: Optional[str] = None,
):
    comment = comment.strip() if comment else None
    if decision == MilestoneApprovalDecision.REJECTED and not comment:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A comment explaining the rejection is required",
        )
    # Lock the row for the duration of this transaction so two near-
    # simultaneous approve/reject calls can't both pass the status check.
    result = await db.execute(
        select(Milestone)
        .where(
            Milestone.id == milestone_id,
            Milestone.project.has(Project.client_id == session.client.id),
        )
        .with_for_update()
    )
    milestone = result.scalar_one_or_none()
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found"
        )
    _require_project_scope(session, milestone.project_id)

    if milestone.status != MilestoneStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Milestone cannot be {decision.value.lower()}ed because it is in status {milestone.status.value}",
        )

    approval = MilestoneApproval(
        milestone_id=milestone.id,
        client_id=session.client.id,
        decision=decision,
        comment=comment,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        access_token_id=session.token.id,
    )
    db.add(approval)

    milestone.status = (
        MilestoneStatus.APPROVED
        if decision == MilestoneApprovalDecision.APPROVED
        else MilestoneStatus.REJECTED
    )
    # Denormalised cache of the latest decision (the approval row above is
    # the audit history).
    milestone.approved_by_client_id = session.client.id
    milestone.approved_at = datetime.now(timezone.utc)

    project = await db.get(Project, milestone.project_id)
    if project is not None:
        log_activity(
            db,
            user_id=project.created_by,
            entity_type="milestone",
            entity_id=milestone.id,
            action=decision.value.lower(),
            summary=f"{session.client.name} {decision.value.lower()} milestone "
            f"{milestone.name}",
            changes={"comment": comment} if comment else None,
        )

    await db.commit()
    await db.refresh(milestone)
    return milestone


# ---------------------------------------------------------------------------
# Account conversion (guest client -> real login)
# ---------------------------------------------------------------------------


class PortalConvertRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # Same rules as registration (see AuthSchema.UserCreate).
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


@router.post("/convert")
async def convert_client_to_user(
    data: PortalConvertRequest,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    client = session.client

    if client.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This client already has an account",
        )

    result = await db.execute(select(User).where(User.email == client.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    new_user = User(
        email=client.email,
        hashed_password=hash_password(data.password),
        full_name=client.name,
        is_verified=True,  # email ownership already proven via the portal token
    )
    db.add(new_user)
    await db.flush()  # get new_user.id without a full commit yet

    client.user_id = new_user.id
    await db.commit()
    await db.refresh(client)

    return {"message": "Account created", "client_id": str(client.id)}