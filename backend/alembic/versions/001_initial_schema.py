"""Initial schema - users, parking_lots, spots, parking_sessions, payments, pricing.

Revision ID: 001
Revises: 
Create Date: 2025-01-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="customer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)

    op.create_table(
        "parking_lots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("mask_path", sa.String(500), nullable=True),
        sa.Column("video_path", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_parking_lots_id", "parking_lots", ["id"], unique=False)

    op.create_table(
        "spots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("parking_lot_id", sa.Integer(), sa.ForeignKey("parking_lots.id"), nullable=False),
        sa.Column("spot_number", sa.String(20), nullable=False),
        sa.Column("bbox", sa.JSON(), nullable=False),
        sa.Column("is_occupied", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("mask_index", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_spots_id", "spots", ["id"], unique=False)
    op.create_index("ix_spots_parking_lot_id", "spots", ["parking_lot_id"], unique=False)

    op.create_table(
        "parking_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("spot_id", sa.Integer(), sa.ForeignKey("spots.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("total_fee", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("plate_number", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_parking_sessions_id", "parking_sessions", ["id"], unique=False)
    op.create_index("ix_parking_sessions_user_id", "parking_sessions", ["user_id"], unique=False)
    op.create_index("ix_parking_sessions_spot_id", "parking_sessions", ["spot_id"], unique=False)

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("parking_sessions.id"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="TRY"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("provider_ref", sa.String(255), nullable=True),
        sa.Column("provider_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_payments_id", "payments", ["id"], unique=False)
    op.create_index("ix_payments_session_id", "payments", ["session_id"], unique=False)

    op.create_table(
        "pricing",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("parking_lot_id", sa.Integer(), sa.ForeignKey("parking_lots.id"), nullable=False),
        sa.Column("hourly_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("first_hour_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("min_charge_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="TRY"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_pricing_id", "pricing", ["id"], unique=False)
    op.create_index("ix_pricing_parking_lot_id", "pricing", ["parking_lot_id"], unique=True)


def downgrade() -> None:
    op.drop_table("pricing")
    op.drop_table("payments")
    op.drop_table("parking_sessions")
    op.drop_table("spots")
    op.drop_table("parking_lots")
    op.drop_table("users")
