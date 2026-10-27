"""activity feed: (user_id, created_at, id) index for cursor pagination

Revision ID: e5b3a9c1d742
Revises: d4a7e2b9c613
Create Date: 2026-10-23 10:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5b3a9c1d742'
down_revision: str | Sequence[str] | None = 'd4a7e2b9c613'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index('ix_activity_owner_created', table_name='activity_events')
    op.create_index(
        'ix_activity_owner_created', 'activity_events', ['user_id', 'created_at', 'id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_activity_owner_created', table_name='activity_events')
    op.create_index(
        'ix_activity_owner_created', 'activity_events', ['user_id', 'created_at']
    )
