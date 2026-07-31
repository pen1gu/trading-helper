"""add_recent_views_table

Revision ID: a1b2c3d4e5f6
Revises: dd6af9f9507b
Create Date: 2026-07-08 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "dd6af9f9507b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recent_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(), nullable=False),
        sa.Column(
            "viewed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_recent_views_id"), "recent_views", ["id"], unique=False)
    op.create_index(op.f("ix_recent_views_ticker"), "recent_views", ["ticker"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_recent_views_ticker"), table_name="recent_views")
    op.drop_index(op.f("ix_recent_views_id"), table_name="recent_views")
    op.drop_table("recent_views")
