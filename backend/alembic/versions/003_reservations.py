"""Add reservations table and is_reserved column to spots.

Revision ID: 003
Revises: 002
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reservations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("spot_id", sa.Integer(), sa.ForeignKey("spots.id"), nullable=False),
        sa.Column("reserved_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "used", "expired", "cancelled", name="reservationstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("plate_number", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_reservations_id", "reservations", ["id"])

    op.add_column("spots", sa.Column("is_reserved", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("spots", "is_reserved")
    op.drop_index("ix_reservations_id", table_name="reservations")
    op.drop_table("reservations")
    op.execute("DROP TYPE IF EXISTS reservationstatus")
