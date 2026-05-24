"""user_vehicles: kullanıcı plaka kayıtları.

Revision ID: 008
Revises: 007
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_vehicles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plate", sa.String(32), nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "plate", name="uq_user_vehicles_user_plate"),
    )
    op.create_index("ix_user_vehicles_id", "user_vehicles", ["id"], unique=False)
    op.create_index("ix_user_vehicles_user_id", "user_vehicles", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_vehicles_user_id", table_name="user_vehicles")
    op.drop_index("ix_user_vehicles_id", table_name="user_vehicles")
    op.drop_table("user_vehicles")
