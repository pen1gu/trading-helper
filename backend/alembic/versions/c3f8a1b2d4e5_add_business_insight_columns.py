"""add_business_insight_columns

Revision ID: c3f8a1b2d4e5
Revises: be5db8abaf25
Create Date: 2026-06-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f8a1b2d4e5"
down_revision: Union[str, Sequence[str], None] = "be5db8abaf25"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("stocks", sa.Column("business_insight", sa.JSON(), nullable=True))
    op.add_column(
        "stocks",
        sa.Column("financials_collected_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("stocks", "financials_collected_at")
    op.drop_column("stocks", "business_insight")
