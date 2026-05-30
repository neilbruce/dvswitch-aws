"""appliance feature tables and enrichment columns

Revision ID: 20260530_0002
Revises: 20260530_0001
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa

revision = '20260530_0002'
down_revision = '20260530_0001'
branch_labels = None
depends_on = None

def _add_column(table, column):
    try:
        op.add_column(table, column)
    except Exception:
        pass

def upgrade():
    _add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    for table in ('stations', 'heard'):
        _add_column(table, sa.Column('name', sa.String(length=120), nullable=True))
        _add_column(table, sa.Column('city', sa.String(length=100), nullable=True))
    _add_column('stations', sa.Column('state', sa.String(length=100), nullable=True))
    _add_column('stations', sa.Column('radioid_updated_at', sa.DateTime(), nullable=True))
    _add_column('nets', sa.Column('archived', sa.Boolean(), nullable=True))
    for column in (
        sa.Column('name', sa.String(length=120), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('join_time', sa.DateTime(), nullable=True),
        sa.Column('last_heard_time', sa.DateTime(), nullable=True),
        sa.Column('late_checkin', sa.Boolean(), nullable=True),
    ):
        _add_column('checkins', column)
    for column in (
        sa.Column('source', sa.String(length=40), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    ):
        _add_column('talkgroups', column)
    _add_column('aprs', sa.Column('raw', sa.Text(), nullable=True))

    op.create_table('heard_history',
        sa.Column('id', sa.Integer(), primary_key=True), sa.Column('source', sa.String(40), nullable=False),
        sa.Column('callsign', sa.String(30), nullable=False), sa.Column('dmr_id', sa.String(30), nullable=True),
        sa.Column('name', sa.String(120), nullable=True), sa.Column('city', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True), sa.Column('talkgroup', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True), sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('duration', sa.Integer(), nullable=True), sa.Column('raw', sa.Text(), nullable=True))
    op.create_table('talkgroup_favorites',
        sa.Column('id', sa.Integer(), primary_key=True), sa.Column('talkgroup', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(120), nullable=True), sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('talkgroup', name='uq_talkgroup_favorite'))
    op.create_table('talkgroup_recent',
        sa.Column('id', sa.Integer(), primary_key=True), sa.Column('talkgroup', sa.Integer(), nullable=False),
        sa.Column('tuned_at', sa.DateTime(), nullable=True), sa.Column('action', sa.String(30), nullable=True))
    op.create_table('radioid_cache',
        sa.Column('dmr_id', sa.String(30), primary_key=True), sa.Column('callsign', sa.String(30), nullable=False),
        sa.Column('name', sa.String(120), nullable=True), sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True), sa.Column('country', sa.String(100), nullable=True),
        sa.Column('raw_json', sa.Text(), nullable=True), sa.Column('fetched_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False))
    op.create_table('log_cursors',
        sa.Column('source', sa.String(40), primary_key=True), sa.Column('path', sa.String(255), nullable=False),
        sa.Column('inode', sa.String(80), nullable=True), sa.Column('offset', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True))

def downgrade():
    for table in ('log_cursors', 'radioid_cache', 'talkgroup_recent', 'talkgroup_favorites', 'heard_history'):
        op.drop_table(table)
