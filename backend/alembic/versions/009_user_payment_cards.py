"""user_payment_cards: kayıtlı kart (son 4 hane).

Revision ID: 009
Revises: 008
Create Date: 2026-03-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_payment_cards",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("last_four", sa.String(4), nullable=False),
        sa.Column("holder_name", sa.String(120), nullable=False),
        sa.Column("exp_month", sa.SmallInteger(), nullable=False),
        sa.Column("exp_year", sa.SmallInteger(), nullable=False),
        sa.Column("brand", sa.String(20), nullable=False),
        sa.Column("label", sa.String(80), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "last_four",
            "exp_month",
            "exp_year",
            name="uq_user_payment_cards_user_last_exp",
        ),
    )
    op.create_index("ix_user_payment_cards_id", "user_payment_cards", ["id"], unique=False)
    op.create_index("ix_user_payment_cards_user_id", "user_payment_cards", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_payment_cards_user_id", table_name="user_payment_cards")
    op.drop_index("ix_user_payment_cards_id", table_name="user_payment_cards")
    op.drop_table("user_payment_cards")
