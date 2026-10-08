from __future__ import annotations
from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Body, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.client_portal import PortalSession, get_portal_session
from app.api.v1.openapi import errors
from app.db.crud.invoices import get_client_invoice, mark_invoice_viewed
from app.db.crud import portal as portal_crud
from app.db.database import get_db
from app.schemas.MilestoneSchema import MilestoneDecision, MilestoneResponse
from app.schemas.ReferenceSchema import PublicExchangeRates
from app.schemas.PortalSchema import (
    PortalConvertRequest,
    PortalInvoiceResponse,
    PortalProjectResponse,
)
from app.services import fx_fetch
from app.services.pdf import pdf_response
from app.models.MilestoneApproval import MilestoneApprovalDecision
from app.models.PortalAccessToken import ScopeType

router = APIRouter(prefix="/portal", tags=["Portal"])


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


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
    return await portal_crud.get_portal_project(
        db, project_id, session.client, session.token
    )


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
    return await portal_crud.get_portal_milestone(
        db, milestone_id, session.client, session.token
    )


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
    return await portal_crud.decide_milestone(
        db,
        milestone_id,
        MilestoneApprovalDecision.APPROVED,
        session.client,
        session.token,
        comment=data.comment if data else None,
        ip_address=_ip(request),
        user_agent=request.headers.get("user-agent"),
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
    return await portal_crud.decide_milestone(
        db,
        milestone_id,
        MilestoneApprovalDecision.REJECTED,
        session.client,
        session.token,
        comment=data.comment if data else None,
        ip_address=_ip(request),
        user_agent=request.headers.get("user-agent"),
    )


@router.get(
    "/invoice/{invoice_id}",
    response_model=PortalInvoiceResponse,
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
    portal_crud.require_scope(session.token, ScopeType.INVOICE, invoice_id)
    invoice = await mark_invoice_viewed(db, invoice_id, session.client.id, _ip(request))
    response = PortalInvoiceResponse.model_validate(invoice)
    response.exchange_rates = PublicExchangeRates.model_validate(
        await fx_fetch.get_exchange_rates(db)
    )
    return response


@router.get(
    "/invoice/{invoice_id}/pdf",
    response_class=Response,
    responses={
        200: {"content": {"application/pdf": {}}, "description": "The invoice PDF."},
        **errors(401, 403, 404),
    },
    summary="Download an invoice as PDF (client portal)",
    description="Requires an invoice-scoped link, like the invoice view. Does not "
    "count as a view.",
)
async def get_portal_invoice_pdf(
    invoice_id: UUID,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    portal_crud.require_scope(session.token, ScopeType.INVOICE, invoice_id)
    invoice = await get_client_invoice(db, invoice_id, session.client.id)
    return pdf_response(invoice, await fx_fetch.get_exchange_rates(db))


# ---------------------------------------------------------------------------
# Account conversion (guest client -> real login)
# ---------------------------------------------------------------------------


@router.post("/convert")
async def convert_client_to_user(
    data: PortalConvertRequest,
    session: PortalSession = Depends(get_portal_session),
    db: AsyncSession = Depends(get_db),
):
    client = await portal_crud.convert_client_to_user(db, session.client, data.password)
    return {"message": "Account created", "client_id": str(client.id)}
