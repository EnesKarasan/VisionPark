"""parking_lots: entry_qr_token sütunu (giriş QR doğrulaması için).

Revision ID: 013
Revises: 012
Create Date: 2026-05-23

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("parking_lots") as batch:
        batch.add_column(
            sa.Column("entry_qr_token", sa.String(length=64), nullable=True)
        )
        batch.create_unique_constraint(
            "uq_parking_lots_entry_qr_token", ["entry_qr_token"]
        )

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id FROM parking_lots")).fetchall()
    for (lot_id,) in rows:
        bind.execute(
            sa.text("UPDATE parking_lots SET entry_qr_token = :t WHERE id = :id"),
            {"t": secrets.token_urlsafe(24), "id": lot_id},
        )


def downgrade() -> None:
    with op.batch_alter_table("parking_lots") as batch:
        batch.drop_constraint("uq_parking_lots_entry_qr_token", type_="unique")
        batch.drop_column("entry_qr_token")
