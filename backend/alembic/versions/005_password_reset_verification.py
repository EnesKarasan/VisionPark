"""password_reset_verifications for forgot-password flow.

Revision ID: 005
Revises: 004
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_verifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("code_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_password_reset_verifications_id", "password_reset_verifications", ["id"])
    op.create_index(
        "ix_password_reset_verifications_email", "password_reset_verifications", ["email"]
    )


def downgrade() -> None:
    op.drop_index("ix_password_reset_verifications_email", table_name="password_reset_verifications")
    op.drop_index("ix_password_reset_verifications_id", table_name="password_reset_verifications")
    op.drop_table("password_reset_verifications")
