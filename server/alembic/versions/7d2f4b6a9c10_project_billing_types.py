"""project billing types: rename budget_type, milestones_enabled, retainer fields

Revision ID: 7d2f4b6a9c10
Revises: 5c1e7a9d3b42
Create Date: 2026-10-05 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7d2f4b6a9c10'
down_revision: Union[str, Sequence[str], None] = '5c1e7a9d3b42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# `recurrenceinterval` already exists (expenses); reuse it, don't recreate.
_interval = sa.Enum('MONTHLY', 'QUARTERLY', 'YEARLY', name='recurrenceinterval', create_type=False)


def upgrade() -> None:
    """Upgrade schema. Hand-edited: autogenerate would drop/add the column and lose data."""
    op.alter_column('projects', 'budget_type', new_column_name='billing_type')
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('ALTER TYPE budgettype RENAME TO billingtype')

    op.add_column('projects', sa.Column(
        'milestones_enabled', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('projects', sa.Column('retainer_amount', sa.Numeric(precision=18, scale=4), nullable=True))
    op.add_column('projects', sa.Column('retainer_interval', _interval, nullable=True))
    op.add_column('projects', sa.Column('retainer_start_date', sa.Date(), nullable=True))

    # Existing data stays valid under the new "milestones need the flag" guard.
    op.execute(
        "UPDATE projects SET milestones_enabled = true "
        "WHERE billing_type = 'MILESTONE' "
        "OR id IN (SELECT DISTINCT project_id FROM milestones)"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('projects', 'retainer_start_date')
    op.drop_column('projects', 'retainer_interval')
    op.drop_column('projects', 'retainer_amount')
    op.drop_column('projects', 'milestones_enabled')
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('ALTER TYPE billingtype RENAME TO budgettype')
    op.alter_column('projects', 'billing_type', new_column_name='budget_type')
