"""Add section and row_number columns to spots table.

Revision ID: 002
Revises: 001
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("spots", sa.Column("section", sa.String(50), nullable=True))
    op.add_column("spots", sa.Column("row_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("spots", "row_number")
    op.drop_column("spots", "section")
