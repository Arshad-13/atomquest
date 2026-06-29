"""Update table schemas

Revision ID: c9d2a6a61a9f
Revises: 2e3b27c2e363
Create Date: 2026-05-16 21:30:00.134537

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9d2a6a61a9f'
down_revision: Union[str, Sequence[str], None] = '2e3b27c2e363'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if is_sqlite:
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.add_column(sa.Column('submitted_by', sa.String(), nullable=False, server_default=''))
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.add_column(sa.Column('reviewed_by', sa.String(), nullable=True))
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.add_column(sa.Column('action', sa.String(), nullable=False, server_default=''))
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.add_column(sa.Column('comment', sa.Text(), nullable=True))
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.add_column(sa.Column('actioned_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True))
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.drop_column('status')
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.drop_column('created_at')
        with op.batch_alter_table('approval_requests') as batch_op:
            batch_op.drop_column('manager_id')

        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.add_column(sa.Column('period_name', sa.String(), nullable=False, server_default=''))
        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.add_column(sa.Column('open_date', sa.DateTime(timezone=True), nullable=False, server_default='CURRENT_TIMESTAMP'))
        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.add_column(sa.Column('close_date', sa.DateTime(timezone=True), nullable=False, server_default='CURRENT_TIMESTAMP'))
        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.drop_column('name')
        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.drop_column('end_date')
        with op.batch_alter_table('cycle_windows') as batch_op:
            batch_op.drop_column('start_date')

        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.add_column(sa.Column('base_goal_id', sa.Integer(), nullable=False, server_default='0'))
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.add_column(sa.Column('primary_owner_id', sa.String(), nullable=False, server_default=''))
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.add_column(sa.Column('recipient_id', sa.String(), nullable=False, server_default=''))
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.add_column(sa.Column('custom_weightage', sa.Float(), nullable=True))
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.add_column(sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True))
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.drop_column('details')
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.drop_column('linked_goal_id')
        with op.batch_alter_table('shared_goal_links') as batch_op:
            batch_op.drop_column('primary_goal_id')
    else:
        op.add_column('approval_requests', sa.Column('submitted_by', sa.String(), nullable=False))
        op.add_column('approval_requests', sa.Column('reviewed_by', sa.String(), nullable=True))
        op.add_column('approval_requests', sa.Column('action', sa.String(), nullable=False))
        op.add_column('approval_requests', sa.Column('comment', sa.Text(), nullable=True))
        op.add_column('approval_requests', sa.Column('actioned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
        op.drop_constraint(op.f('approval_requests_manager_id_fkey'), 'approval_requests', type_='foreignkey')
        op.create_foreign_key(None, 'approval_requests', 'users', ['reviewed_by'], ['id'])
        op.create_foreign_key(None, 'approval_requests', 'users', ['submitted_by'], ['id'])
        op.drop_column('approval_requests', 'status')
        op.drop_column('approval_requests', 'created_at')
        op.drop_column('approval_requests', 'manager_id')
        op.add_column('cycle_windows', sa.Column('period_name', sa.String(), nullable=False))
        op.add_column('cycle_windows', sa.Column('open_date', sa.DateTime(timezone=True), nullable=False))
        op.add_column('cycle_windows', sa.Column('close_date', sa.DateTime(timezone=True), nullable=False))
        op.drop_column('cycle_windows', 'name')
        op.drop_column('cycle_windows', 'end_date')
        op.drop_column('cycle_windows', 'start_date')
        op.add_column('shared_goal_links', sa.Column('base_goal_id', sa.Integer(), nullable=False))
        op.add_column('shared_goal_links', sa.Column('primary_owner_id', sa.String(), nullable=False))
        op.add_column('shared_goal_links', sa.Column('recipient_id', sa.String(), nullable=False))
        op.add_column('shared_goal_links', sa.Column('custom_weightage', sa.Float(), nullable=True))
        op.add_column('shared_goal_links', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
        op.drop_constraint(op.f('shared_goal_links_linked_goal_id_fkey'), 'shared_goal_links', type_='foreignkey')
        op.drop_constraint(op.f('shared_goal_links_primary_goal_id_fkey'), 'shared_goal_links', type_='foreignkey')
        op.create_foreign_key(None, 'shared_goal_links', 'users', ['recipient_id'], ['id'])
        op.create_foreign_key(None, 'shared_goal_links', 'goals', ['base_goal_id'], ['id'])
        op.create_foreign_key(None, 'shared_goal_links', 'users', ['primary_owner_id'], ['id'])
        op.drop_column('shared_goal_links', 'details')
        op.drop_column('shared_goal_links', 'linked_goal_id')
        op.drop_column('shared_goal_links', 'primary_goal_id')
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('shared_goal_links', sa.Column('primary_goal_id', sa.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('shared_goal_links', sa.Column('linked_goal_id', sa.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('shared_goal_links', sa.Column('details', sa.TEXT(), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'shared_goal_links', type_='foreignkey')
    op.drop_constraint(None, 'shared_goal_links', type_='foreignkey')
    op.drop_constraint(None, 'shared_goal_links', type_='foreignkey')
    op.create_foreign_key(op.f('shared_goal_links_primary_goal_id_fkey'), 'shared_goal_links', 'goals', ['primary_goal_id'], ['id'])
    op.create_foreign_key(op.f('shared_goal_links_linked_goal_id_fkey'), 'shared_goal_links', 'goals', ['linked_goal_id'], ['id'])
    op.drop_column('shared_goal_links', 'created_at')
    op.drop_column('shared_goal_links', 'custom_weightage')
    op.drop_column('shared_goal_links', 'recipient_id')
    op.drop_column('shared_goal_links', 'primary_owner_id')
    op.drop_column('shared_goal_links', 'base_goal_id')
    op.add_column('cycle_windows', sa.Column('start_date', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False))
    op.add_column('cycle_windows', sa.Column('end_date', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=False))
    op.add_column('cycle_windows', sa.Column('name', sa.VARCHAR(), autoincrement=False, nullable=False))
    op.drop_column('cycle_windows', 'close_date')
    op.drop_column('cycle_windows', 'open_date')
    op.drop_column('cycle_windows', 'period_name')
    op.add_column('approval_requests', sa.Column('manager_id', sa.VARCHAR(), autoincrement=False, nullable=False))
    op.add_column('approval_requests', sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True))
    op.add_column('approval_requests', sa.Column('status', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.drop_constraint(None, 'approval_requests', type_='foreignkey')
    op.drop_constraint(None, 'approval_requests', type_='foreignkey')
    op.create_foreign_key(op.f('approval_requests_manager_id_fkey'), 'approval_requests', 'users', ['manager_id'], ['id'])
    op.drop_column('approval_requests', 'actioned_at')
    op.drop_column('approval_requests', 'comment')
    op.drop_column('approval_requests', 'action')
    op.drop_column('approval_requests', 'reviewed_by')
    op.drop_column('approval_requests', 'submitted_by')
    # ### end Alembic commands ###
