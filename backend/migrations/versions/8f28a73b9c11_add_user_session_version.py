"""add user session version

Revision ID: 8f28a73b9c11
Revises: 1ea62d17932e
Create Date: 2026-10-13 15:40:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8f28a73b9c11"
down_revision: str | Sequence[str] | None = "1ea62d17932e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "session_version",
            sa.Integer(),
            server_default=sa.text("1"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "session_version")
