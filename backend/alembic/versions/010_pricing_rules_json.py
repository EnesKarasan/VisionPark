"""pricing: süre dilimleri JSON (ücretsiz dakika + kademeli ücret).

Revision ID: 010
Revises: 009
Create Date: 2026-04-03

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DEFAULT_RULES = {
    "free_minutes": 15,
    "brackets": [
        {"max_minutes": 60, "price": "110"},
        {"max_minutes": 120, "price": "140"},
        {"max_minutes": 240, "price": "170"},
        {"max_minutes": 480, "price": "220"},
        {"max_minutes": 720, "price": "260"},
        {"price": "370"},
    ],
}


def upgrade() -> None:
    op.add_column("pricing", sa.Column("pricing_rules", sa.JSON(), nullable=True))
    bind = op.get_bind()
    payload = json.dumps(_DEFAULT_RULES)
    bind.execute(
        sa.text("UPDATE pricing SET pricing_rules = :rules WHERE pricing_rules IS NULL"),
        {"rules": payload},
    )


def downgrade() -> None:
    op.drop_column("pricing", "pricing_rules")
