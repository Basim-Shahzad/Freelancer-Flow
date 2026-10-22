from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterator

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.api.dependencies.auth import CurrentFreelancer, CurrentUser, DBSession
from app.api.dependencies.rate_limit import client_ip
from app.api.v1.openapi import errors
from app.core.config import settings
from app.core.errors import Forbidden
from app.core.security import verify_password
from app.db.crud.activity import log_activity
from app.db.crud.export import collect_export_data
from app.schemas.ExportSchema import ExportRequest
from app.services.export import build_zip
from app.services.rate_limit import check_rate_limit

router = APIRouter(prefix="/export", tags=["Export"])

CHUNK_SIZE = 64 * 1024


def _stream(spool) -> Iterator[bytes]:
    try:
        while chunk := spool.read(CHUNK_SIZE):
            yield chunk
    finally:
        spool.close()


@router.post(
    "",
    summary="Export all data",
    description="Streams a ZIP of the caller's data: one JSON file per entity, CSVs for invoices, "
    "payments, time entries and expenses, and each invoice as a PDF. Payment details are "
    "included decrypted, so the account password is re-checked first. Tokens and password "
    "hashes are never exported. Rate limited per user.",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/zip": {}}}, **errors(401, 403, 429)},
)
async def export_data(
    payload: ExportRequest,
    request: Request,
    user: CurrentUser,
    freelancer: CurrentFreelancer,
    db: DBSession,
):
    # Counted before the password check so guessing is throttled too.
    await check_rate_limit(
        db,
        f"export:ip:{client_ip(request) or 'unknown'}",
        limit=settings.EXPORT_RATE_LIMIT * 3,
        window_seconds=settings.EXPORT_RATE_WINDOW_SECONDS,
    )
    await check_rate_limit(
        db,
        f"export:{user.id}",
        limit=settings.EXPORT_RATE_LIMIT,
        window_seconds=settings.EXPORT_RATE_WINDOW_SECONDS,
    )
    if not verify_password(payload.password, user.hashed_password):
        raise Forbidden("Incorrect password")

    data = await collect_export_data(
        db, user, freelancer, app_version=request.app.version
    )
    spool = await run_in_threadpool(build_zip, data)

    log_activity(
        db,
        user_id=user.id,
        entity_type="export",
        entity_id=freelancer.id,
        action="export",
        summary="Exported all data",
    )
    await db.commit()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(
        _stream(spool),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="paylancer-export-{stamp}.zip"'
        },
    )
