"""parking_intents: kind alanı (entry/exit).

Revision ID: 016
Revises: 015
Create Date: 2026-05-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("parking_intents") as batch:
        batch.add_column(
            sa.Column(
                "kind",
                sa.String(length=10),
                nullable=False,
                server_default="entry",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("parking_intents") as batch:
        batch.drop_column("kind")
