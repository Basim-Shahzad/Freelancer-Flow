import logging
import uuid

# Configure logger
logger = logging.getLogger(__name__)


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