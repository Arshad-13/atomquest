"""Add escalation_rules and escalation_logs tables

Revision ID: a1b2c3d4e5f6
Revises: 2e3b27c2e363
Create Date: 2026-05-17 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '2e3b27c2e363'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create escalation_rules and escalation_logs tables."""
    op.create_table(
        'escalation_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('trigger_event', sa.String(), nullable=True),
        sa.Column('days_threshold', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('trigger_event'),
    )
    op.create_index(op.f('ix_escalation_rules_id'), 'escalation_rules', ['id'], unique=False)

    op.create_table(
        'escalation_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=True),
        sa.Column('employee_id', sa.String(), nullable=True),
        sa.Column('manager_id', sa.String(), nullable=True),
        sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['users.id']),
        sa.ForeignKeyConstraint(['manager_id'], ['users.id']),
        sa.ForeignKeyConstraint(['rule_id'], ['escalation_rules.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_escalation_logs_id'), 'escalation_logs', ['id'], unique=False)


def downgrade() -> None:
    """Drop escalation tables."""
    op.drop_index(op.f('ix_escalation_logs_id'), table_name='escalation_logs')
    op.drop_table('escalation_logs')
    op.drop_index(op.f('ix_escalation_rules_id'), table_name='escalation_rules')
    op.drop_table('escalation_rules')
