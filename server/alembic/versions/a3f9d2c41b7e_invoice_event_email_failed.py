"""add EMAIL_FAILED invoice event type

Revision ID: a3f9d2c41b7e
Revises: 8748d1b38480
Create Date: 2026-10-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f9d2c41b7e'
down_revision: Union[str, Sequence[str], None] = '8748d1b38480'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ADD VALUE cannot run inside a transaction block on older PostgreSQL.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE invoiceeventtype ADD VALUE IF NOT EXISTS 'EMAIL_FAILED'")


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL cannot drop an enum value; leaving it in place is harmless.
    pass
