"""payments: kart özeti (son 4 hane, marka).

Revision ID: 012
Revises: 011
Create Date: 2026-04-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("card_last_four", sa.String(length=4), nullable=True))
    op.add_column("payments", sa.Column("card_brand", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "card_brand")
    op.drop_column("payments", "card_last_four")
