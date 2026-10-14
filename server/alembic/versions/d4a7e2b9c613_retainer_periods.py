"""retainer periods: projects.retainer_end_date, invoices.retainer_period_start

Revision ID: d4a7e2b9c613
Revises: b8e1c5d7a2f4
Create Date: 2026-10-14 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a7e2b9c613'
down_revision: Union[str, Sequence[str], None] = 'b8e1c5d7a2f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('projects', sa.Column('retainer_end_date', sa.Date(), nullable=True))
    op.add_column('invoices', sa.Column('retainer_period_start', sa.Date(), nullable=True))
    op.create_index(
        'uq_invoices_project_retainer_period',
        'invoices',
        ['project_id', 'retainer_period_start'],
        unique=True,
        postgresql_where=sa.text("status != 'CANCELLED'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        'uq_invoices_project_retainer_period',
        table_name='invoices',
        postgresql_where=sa.text("status != 'CANCELLED'"),
    )
    op.drop_column('invoices', 'retainer_period_start')
    op.drop_column('projects', 'retainer_end_date')
