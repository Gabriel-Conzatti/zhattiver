"""enforce monthly goal uniqueness

Revision ID: 6c9e0b4d7a12
Revises: 4b7ac198d21e
Create Date: 2026-10-13 21:24:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6c9e0b4d7a12"
down_revision: str | Sequence[str] | None = "4b7ac198d21e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "uq_monthly_goals_general_scope",
        "monthly_goals",
        ["organization_id", "user_id", "year", "month"],
        unique=True,
        postgresql_where=sa.text("product_id IS NULL"),
    )
    op.create_index(
        "uq_monthly_goals_product_scope",
        "monthly_goals",
        ["organization_id", "user_id", "product_id", "year", "month"],
        unique=True,
        postgresql_where=sa.text("product_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_monthly_goals_product_scope", table_name="monthly_goals")
    op.drop_index("uq_monthly_goals_general_scope", table_name="monthly_goals")
