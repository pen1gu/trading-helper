"""add_disclosures_table

Revision ID: e6f7a8b9c0d1
Revises: b329bdcb4bdc
Create Date: 2026-06-10 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "b329bdcb4bdc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "disclosures",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("rcept_no", sa.String(), nullable=False),
        sa.Column("report_nm", sa.String(), nullable=False),
        sa.Column("report_type", sa.String(), nullable=False),
        sa.Column("rcept_dt", sa.Date(), nullable=False),
        sa.Column("dart_url", sa.String(), nullable=True),
        sa.Column("summary", sa.String(), nullable=True),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rcept_no", name="uq_disclosures_rcept_no"),
    )
    op.create_index(op.f("ix_disclosures_id"), "disclosures", ["id"], unique=False)
    op.create_index(op.f("ix_disclosures_rcept_no"), "disclosures", ["rcept_no"], unique=True)
    op.create_index(op.f("ix_disclosures_stock_id"), "disclosures", ["stock_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_disclosures_stock_id"), table_name="disclosures")
    op.drop_index(op.f("ix_disclosures_rcept_no"), table_name="disclosures")
    op.drop_index(op.f("ix_disclosures_id"), table_name="disclosures")
    op.drop_table("disclosures")
