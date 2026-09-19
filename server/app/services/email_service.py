import logging
import uuid
from datetime import datetime

# Configure logger
logger = logging.getLogger(__name__)

# NOTE: these are development stand-ins that log instead of delivering mail.
# Swap the bodies for a real provider (SES, Postmark, ...) without changing
# the call signatures. Portal links carry bearer tokens: in production do not
# log them.


async def send_portal_approval_email(
    to_client_id: uuid.UUID,
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    portal_token: str,
) -> None:
    """
    Mock function to send a portal approval email to the client.
    Currently logs the payload to the console for debugging/development.
    """
    logger.info("=" * 60)
    logger.info("[MOCK EMAIL SENT] Portal Approval Request")
    logger.info(f"  To Client ID : {to_client_id}")
    logger.info(f"  Project ID  : {project_id}")
    logger.info(f"  Milestone ID: {milestone_id}")
    logger.info(f"  Portal Token: {portal_token}")
    logger.info("=" * 60)


async def send_invoice_email(
    to_email: str,
    client_name: str,
    invoice_number: str,
    total: str,
    currency: str,
    due_date: datetime,
    portal_url: str,
) -> None:
    """Mock: email the client a link to view their invoice."""
    logger.info("=" * 60)
    logger.info("[MOCK EMAIL SENT] Invoice")
    logger.info(f"  To      : {client_name} <{to_email}>")
    logger.info(f"  Invoice : {invoice_number} - {currency} {total}, due {due_date:%Y-%m-%d}")
    logger.info(f"  Link    : {portal_url}")
    logger.info("=" * 60)


async def send_invoice_reminder_email(
    to_email: str,
    client_name: str,
    invoice_number: str,
    balance_due: str,
    currency: str,
    due_date: datetime,
    overdue: bool,
    portal_url: str,
) -> None:
    """Mock: remind the client about an unpaid invoice."""
    logger.info("=" * 60)
    logger.info("[MOCK EMAIL SENT] Invoice reminder (%s)", "OVERDUE" if overdue else "upcoming")
    logger.info(f"  To      : {client_name} <{to_email}>")
    logger.info(f"  Invoice : {invoice_number} - {currency} {balance_due} outstanding, due {due_date:%Y-%m-%d}")
    logger.info(f"  Link    : {portal_url}")
    logger.info("=" * 60)
