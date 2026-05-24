"""Reservation scheduled start, entry deadline, user missed-entry strikes.

Revision ID: 011
Revises: 010
Create Date: 2026-04-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("missed_reservation_entry_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("reservations", sa.Column("scheduled_start_at", sa.DateTime(), nullable=True))
    op.add_column("reservations", sa.Column("entry_deadline_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("reservations", "entry_deadline_at")
    op.drop_column("reservations", "scheduled_start_at")
    op.drop_column("users", "missed_reservation_entry_count")
