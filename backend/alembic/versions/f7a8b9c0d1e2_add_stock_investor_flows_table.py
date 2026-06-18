"""add_stock_investor_flows_table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-06-10 18:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_investor_flows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("foreign_net", sa.BigInteger(), nullable=True),
        sa.Column("institutional_net", sa.BigInteger(), nullable=True),
        sa.Column("individual_net", sa.BigInteger(), nullable=True),
        sa.Column("foreign_net_5d", sa.Float(), nullable=True),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "stock_id", "trade_date", name="uq_stock_investor_flows_stock_date"
        ),
    )
    op.create_index(
        op.f("ix_stock_investor_flows_id"), "stock_investor_flows", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_stock_investor_flows_stock_id"),
        "stock_investor_flows",
        ["stock_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_stock_investor_flows_stock_id"), table_name="stock_investor_flows")
    op.drop_index(op.f("ix_stock_investor_flows_id"), table_name="stock_investor_flows")
    op.drop_table("stock_investor_flows")
