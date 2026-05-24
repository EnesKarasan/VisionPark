"""parking_intents tablosu - QR ile giriş niyeti.

Revision ID: 014
Revises: 013
Create Date: 2026-05-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parking_intents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("spot_id", sa.Integer(), sa.ForeignKey("spots.id"), nullable=False),
        sa.Column("plate_number", sa.String(length=20), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_parking_intents_token", "parking_intents", ["token"], unique=True)
    op.create_index("ix_parking_intents_user_id", "parking_intents", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_parking_intents_user_id", table_name="parking_intents")
    op.drop_index("ix_parking_intents_token", table_name="parking_intents")
    op.drop_table("parking_intents")
