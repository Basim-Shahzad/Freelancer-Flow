"""close model gaps: payments, running timers, milestone money, invoice lifecycle,
expenses, VAT remittances, change requests, activity feed; fix integrity bugs

Revision ID: b3f1c9a7d2e4
Revises: 649c7109147f
Create Date: 2026-09-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b3f1c9a7d2e4'
down_revision: Union[str, Sequence[str], None] = '649c7109147f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _replace_fk(table: str, column: str, referred_table: str, ondelete: str) -> None:
    """Drop the existing FK on ``table.column`` (whatever it is named) and
    recreate it with the given ON DELETE behaviour."""
    inspector = sa.inspect(op.get_bind())
    for fk in inspector.get_foreign_keys(table):
        if fk["constrained_columns"] == [column]:
            op.drop_constraint(fk["name"], table, type_="foreignkey")
    op.create_foreign_key(
        f"fk_{table}_{column}_{referred_table}",
        table,
        referred_table,
        [column],
        ["id"],
        ondelete=ondelete,
    )


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    # ---- freelancers: business identity, defaults, invoice sequence, cash --
    op.add_column('freelancers', sa.Column('currency', sa.String(length=3), nullable=False, server_default='SAR'))
    op.add_column('freelancers', sa.Column('business_name', sa.String(length=255), nullable=True))
    op.add_column('freelancers', sa.Column('business_address', sa.Text(), nullable=True))
    op.add_column('freelancers', sa.Column('vat_number', sa.String(length=50), nullable=True))
    op.add_column('freelancers', sa.Column('logo_url', sa.String(length=1024), nullable=True))
    op.add_column('freelancers', sa.Column('default_payment_terms_days', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('freelancers', sa.Column('default_tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('freelancers', sa.Column('invoice_sequence', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('freelancers', sa.Column('bank_balance', sa.Numeric(precision=13, scale=2), nullable=True))
    op.add_column('freelancers', sa.Column('bank_balance_updated_at', sa.DateTime(timezone=True), nullable=True))

    # ---- clients ----------------------------------------------------------
    op.add_column('clients', sa.Column('payment_terms_days', sa.Integer(), nullable=True))
    op.add_column('clients', sa.Column('currency', sa.String(length=3), nullable=True))

    # ---- projects ---------------------------------------------------------
    op.add_column('projects', sa.Column('currency', sa.String(length=3), nullable=True))
    op.add_column('projects', sa.Column('hourly_rate', sa.Numeric(precision=13, scale=2), nullable=True))
    op.alter_column('projects', 'budget', existing_type=sa.Numeric(precision=10, scale=2), type_=sa.Numeric(precision=13, scale=2), existing_nullable=True)
    # Derived from SUM(time_entries.duration_minutes) at read time instead.
    op.drop_column('projects', 'total_time_spent')

    # ---- milestones -------------------------------------------------------
    op.add_column('milestones', sa.Column('amount', sa.Numeric(precision=13, scale=2), nullable=True))
    op.add_column('milestones', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('milestones', sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
    op.execute(
        """
        UPDATE milestones m SET sort_order = s.rn
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at) - 1 AS rn
            FROM milestones
        ) s
        WHERE m.id = s.id
        """
    )
    # Deleting a client must not delete their milestones.
    _replace_fk('milestones', 'approved_by_client_id', 'clients', 'SET NULL')

    op.add_column('milestone_approvals', sa.Column('comment', sa.Text(), nullable=True))

    # ---- portal tokens ----------------------------------------------------
    op.add_column('portal_tokens', sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True))
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE scopetype ADD VALUE IF NOT EXISTS 'INVOICE'")

    # ---- time entries -----------------------------------------------------
    op.add_column('time_entries', sa.Column('user_id', sa.UUID(), nullable=True))
    op.add_column('time_entries', sa.Column('hourly_rate', sa.Numeric(precision=13, scale=2), nullable=True))
    op.execute(
        "UPDATE time_entries t SET user_id = p.created_by FROM projects p WHERE t.project_id = p.id"
    )
    # Best available rate snapshot for history: the owner's current profile rate.
    op.execute(
        """
        UPDATE time_entries t SET hourly_rate = f.hourly_rate
        FROM projects p JOIN freelancers f ON f.user_id = p.created_by
        WHERE t.project_id = p.id
        """
    )
    op.alter_column('time_entries', 'user_id', nullable=False)
    op.create_foreign_key('fk_time_entries_user_id_users', 'time_entries', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    # NULL end_time == running timer.
    op.alter_column('time_entries', 'end_time', existing_type=sa.DateTime(timezone=True), nullable=True)
    # Deleting a milestone must not delete already-invoiced time.
    _replace_fk('time_entries', 'milestone_id', 'milestones', 'SET NULL')
    op.create_index('ix_time_entries_project_id', 'time_entries', ['project_id'], unique=False)
    op.create_index(
        'uq_time_entries_one_running_per_user',
        'time_entries',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('end_time IS NULL'),
    )

    # ---- invoices ---------------------------------------------------------
    op.add_column('invoices', sa.Column('currency', sa.String(length=3), nullable=True))
    op.add_column('invoices', sa.Column('discount_amount', sa.Numeric(precision=13, scale=2), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('tax_amount', sa.Numeric(precision=13, scale=2), nullable=False, server_default='0'))
    op.add_column('invoices', sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('viewed_at', sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE invoices i SET currency = COALESCE(f.currency, 'SAR') FROM freelancers f WHERE f.id = i.freelancer_id"
    )
    op.alter_column('invoices', 'currency', nullable=False)
    op.execute(
        """
        UPDATE invoices SET
            discount_amount = ROUND(subtotal * discount_rate / 100, 2),
            tax_amount = ROUND((subtotal - ROUND(subtotal * discount_rate / 100, 2)) * tax_rate / 100, 2)
        """
    )
    op.alter_column('invoices', 'tax_rate', existing_type=sa.Numeric(precision=4, scale=2), type_=sa.Numeric(precision=5, scale=2), existing_nullable=False)
    op.alter_column('invoices', 'discount_rate', existing_type=sa.Numeric(precision=4, scale=2), type_=sa.Numeric(precision=5, scale=2), existing_nullable=False)

    # payment_at: NULL until fully paid (it used to default to "now").
    op.alter_column('invoices', 'payment_at', existing_type=sa.DateTime(timezone=True), nullable=True)
    op.execute("UPDATE invoices SET payment_at = NULL WHERE status::text <> 'PAID'")

    # Status enum: fix the CANCELEED typo and drop the stored OVERDUE (derived).
    op.execute("ALTER TYPE invoicestatus RENAME TO invoicestatus_old")
    sa.Enum('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', name='invoicestatus').create(bind)
    op.execute(
        """
        ALTER TABLE invoices ALTER COLUMN status TYPE invoicestatus USING (
            CASE status::text
                WHEN 'CANCELEED' THEN 'CANCELLED'
                WHEN 'OVERDUE' THEN 'SENT'
                ELSE status::text
            END
        )::invoicestatus
        """
    )
    op.execute("DROP TYPE invoicestatus_old")

    # invoice_number: required and unique per freelancer.
    op.execute(
        """
        UPDATE invoices
        SET invoice_number = 'INV-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
        WHERE invoice_number IS NULL
        """
    )
    op.alter_column('invoices', 'invoice_number', existing_type=sa.String(length=50), nullable=False)
    op.create_unique_constraint('uq_invoice_freelancer_number', 'invoices', ['freelancer_id', 'invoice_number'])

    # ---- new tables -------------------------------------------------------
    op.create_table(
        'payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=13, scale=2), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('method', sa.Enum('BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE', 'PAYPAL', 'OTHER', name='paymentmethod'), nullable=False),
        sa.Column('reference', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payments_invoice_id', 'payments', ['invoice_id'], unique=False)

    op.create_table(
        'invoice_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.Enum('SENT', 'VIEWED', 'REMINDED', 'PAYMENT_RECORDED', 'PAID', 'CANCELLED', name='invoiceeventtype'), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('detail', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invoice_events_invoice_id', 'invoice_events', ['invoice_id'], unique=False)

    op.create_table(
        'expenses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('freelancer_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('vendor', sa.String(length=255), nullable=True),
        sa.Column('amount', sa.Numeric(precision=13, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('incurred_on', sa.Date(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False),
        sa.Column('recurrence', sa.Enum('MONTHLY', 'QUARTERLY', 'YEARLY', name='recurrenceinterval'), nullable=True),
        sa.Column('recurrence_ends_on', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['freelancers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expenses_freelancer_incurred', 'expenses', ['freelancer_id', 'incurred_on'], unique=False)

    op.create_table(
        'vat_remittances',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('freelancer_id', sa.UUID(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=13, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reference', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['freelancer_id'], ['freelancers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_vat_remittances_freelancer_period', 'vat_remittances', ['freelancer_id', 'period_end'], unique=False)

    op.create_table(
        'change_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', name='changerequeststatus'), nullable=False),
        sa.Column('estimated_hours', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('estimated_amount', sa.Numeric(precision=13, scale=2), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decision_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_change_requests_project_id', 'change_requests', ['project_id'], unique=False)

    op.create_table(
        'activity_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('summary', sa.String(length=255), nullable=False),
        sa.Column('changes', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_activity_owner_created', 'activity_events', ['user_id', 'created_at'], unique=False)
    op.create_index('ix_activity_entity', 'activity_events', ['entity_type', 'entity_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema (best effort: data in dropped columns/tables is lost)."""
    bind = op.get_bind()

    op.drop_table('activity_events')
    op.drop_table('change_requests')
    op.drop_table('vat_remittances')
    op.drop_table('expenses')
    op.drop_table('invoice_events')
    op.drop_table('payments')
    for enum_name in ('paymentmethod', 'invoiceeventtype', 'recurrenceinterval', 'changerequeststatus'):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)

    # ---- invoices ---------------------------------------------------------
    op.drop_constraint('uq_invoice_freelancer_number', 'invoices', type_='unique')
    op.alter_column('invoices', 'invoice_number', existing_type=sa.String(length=50), nullable=True)

    op.execute("ALTER TYPE invoicestatus RENAME TO invoicestatus_new")
    sa.Enum('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELEED', name='invoicestatus').create(bind)
    op.execute(
        """
        ALTER TABLE invoices ALTER COLUMN status TYPE invoicestatus USING (
            CASE status::text WHEN 'CANCELLED' THEN 'CANCELEED' ELSE status::text END
        )::invoicestatus
        """
    )
    op.execute("DROP TYPE invoicestatus_new")

    op.execute("UPDATE invoices SET payment_at = COALESCE(payment_at, now())")
    op.alter_column('invoices', 'payment_at', existing_type=sa.DateTime(timezone=True), nullable=False)
    op.alter_column('invoices', 'discount_rate', existing_type=sa.Numeric(precision=5, scale=2), type_=sa.Numeric(precision=4, scale=2), existing_nullable=False)
    op.alter_column('invoices', 'tax_rate', existing_type=sa.Numeric(precision=5, scale=2), type_=sa.Numeric(precision=4, scale=2), existing_nullable=False)
    for column in ('viewed_at', 'sent_at', 'tax_amount', 'discount_amount', 'currency'):
        op.drop_column('invoices', column)

    # ---- time entries -----------------------------------------------------
    op.drop_index('uq_time_entries_one_running_per_user', table_name='time_entries', postgresql_where=sa.text('end_time IS NULL'))
    op.drop_index('ix_time_entries_project_id', table_name='time_entries')
    _replace_fk('time_entries', 'milestone_id', 'milestones', 'CASCADE')
    op.execute("DELETE FROM time_entries WHERE end_time IS NULL")
    op.alter_column('time_entries', 'end_time', existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_constraint('fk_time_entries_user_id_users', 'time_entries', type_='foreignkey')
    op.drop_column('time_entries', 'hourly_rate')
    op.drop_column('time_entries', 'user_id')

    # ---- portal tokens: enum values cannot be removed, so rebuild the type -
    op.execute("DELETE FROM portal_tokens WHERE scope_type::text = 'INVOICE'")
    op.execute("ALTER TYPE scopetype RENAME TO scopetype_new")
    sa.Enum('PROJECT', 'MILESTONE', name='scopetype').create(bind)
    op.execute("ALTER TABLE portal_tokens ALTER COLUMN scope_type TYPE scopetype USING scope_type::text::scopetype")
    op.execute("DROP TYPE scopetype_new")
    op.drop_column('portal_tokens', 'last_used_at')

    # ---- milestones -------------------------------------------------------
    op.drop_column('milestone_approvals', 'comment')
    _replace_fk('milestones', 'approved_by_client_id', 'clients', 'CASCADE')
    op.drop_column('milestones', 'submitted_at')
    op.drop_column('milestones', 'sort_order')
    op.drop_column('milestones', 'amount')

    # ---- projects ---------------------------------------------------------
    op.add_column('projects', sa.Column('total_time_spent', sa.Integer(), nullable=True))
    op.execute(
        "UPDATE projects p SET total_time_spent = COALESCE((SELECT SUM(duration_minutes) FROM time_entries t WHERE t.project_id = p.id), 0)"
    )
    op.alter_column('projects', 'budget', existing_type=sa.Numeric(precision=13, scale=2), type_=sa.Numeric(precision=10, scale=2), existing_nullable=True)
    op.drop_column('projects', 'hourly_rate')
    op.drop_column('projects', 'currency')

    # ---- clients / freelancers -------------------------------------------
    op.drop_column('clients', 'currency')
    op.drop_column('clients', 'payment_terms_days')
    for column in (
        'bank_balance_updated_at', 'bank_balance', 'invoice_sequence',
        'default_tax_rate', 'default_payment_terms_days', 'logo_url',
        'vat_number', 'business_address', 'business_name', 'currency',
    ):
        op.drop_column('freelancers', column)
