"""rate limit counters (DB-backed fixed-window limiter)

Revision ID: f7c2a8d1e935
Revises: e5b3a9c1d742
Create Date: 2026-10-23 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f7c2a8d1e935'
down_revision: Union[str, Sequence[str], None] = 'e5b3a9c1d742'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'rate_limit_counters',
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('window_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('key', 'window_start'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('rate_limit_counters')
