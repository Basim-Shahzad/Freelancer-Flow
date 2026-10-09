"""add clients.whatsapp_number

Revision ID: b8e1c5d7a2f4
Revises: a3f9d2c41b7e
Create Date: 2026-10-09 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e1c5d7a2f4'
down_revision: Union[str, Sequence[str], None] = 'a3f9d2c41b7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('clients', sa.Column('whatsapp_number', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('clients', 'whatsapp_number')
