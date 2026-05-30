"""initial appliance schema

Revision ID: 20260530_0001
Revises:
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa

revision = '20260530_0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # This baseline is intentionally schema-synchronized through SQLAlchemy create_all
    # for existing personal SQLite deployments. New installs run setup_database.py
    # followed by alembic stamp head; future revisions will contain ALTER steps.
    pass

def downgrade():
    pass
