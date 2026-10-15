"""add claim catalogs and workshops

Revision ID: b4c91e8d2f60
Revises: 7d2f4c8a91be
Create Date: 2026-10-15 18:20:00
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "b4c91e8d2f60"
down_revision: str | Sequence[str] | None = "7d2f4c8a91be"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_BRANCHES = ("Auto", "RE", "RCO ONIBUS")
DEFAULT_INSURERS = (
    "Allianz",
    "Azul",
    "Bradesco",
    "HDI",
    "Porto",
    "Sura",
    "Tokio",
    "Yelum",
    "Zurich",
    "Aliro",
    "ESSOR/LIVONIUS",
    "EZZE",
    "Mapfre",
    "Suhai",
)


def _ensure_named_row(
    connection,
    *,
    table: str,
    organization_id: str,
    name: str,
    with_active: bool,
) -> str:
    existing = connection.execute(
        sa.text(
            f"SELECT id FROM {table} "
            "WHERE organization_id = :organization_id AND lower(name) = lower(:name) "
            "ORDER BY archived_at NULLS FIRST LIMIT 1"
        ),
        {"organization_id": organization_id, "name": name},
    ).scalar_one_or_none()
    if existing:
        assignments = "archived_at = NULL"
        if with_active:
            assignments += ", is_active = true"
        connection.execute(
            sa.text(f"UPDATE {table} SET {assignments} WHERE id = :id"),
            {"id": existing},
        )
        return str(existing)

    row_id = str(uuid4())
    active_columns = ", is_active" if with_active else ""
    active_values = ", true" if with_active else ""
    connection.execute(
        sa.text(
            f"INSERT INTO {table} "
            f"(id, organization_id, name{active_columns}, created_at, updated_at, archived_at) "
            f"VALUES (:id, :organization_id, :name{active_values}, now(), now(), NULL)"
        ),
        {"id": row_id, "organization_id": organization_id, "name": name},
    )
    return row_id


def upgrade() -> None:
    op.create_table(
        "claim_branches",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_claim_branches_org_name",
        "claim_branches",
        ["organization_id", "name"],
        unique=True,
    )
    op.create_table(
        "claim_workshops",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("responsible_name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_claim_workshops_org_name",
        "claim_workshops",
        ["organization_id", "name"],
        unique=True,
    )
    op.create_table(
        "claim_workshop_insurers",
        sa.Column("workshop_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("insurer_id", sa.UUID(as_uuid=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["workshop_id"], ["claim_workshops.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["insurer_id"], ["insurers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workshop_id", "insurer_id"),
    )

    op.add_column(
        "claims", sa.Column("branch_id", sa.UUID(as_uuid=False), nullable=True)
    )
    op.add_column(
        "claims", sa.Column("insurer_id", sa.UUID(as_uuid=False), nullable=True)
    )
    op.add_column(
        "claims", sa.Column("workshop_id", sa.UUID(as_uuid=False), nullable=True)
    )

    connection = op.get_bind()
    organization_ids = connection.execute(
        sa.text("SELECT id FROM organizations")
    ).scalars()
    for organization_id in organization_ids:
        organization_id = str(organization_id)
        for branch in DEFAULT_BRANCHES:
            _ensure_named_row(
                connection,
                table="claim_branches",
                organization_id=organization_id,
                name=branch,
                with_active=True,
            )
        for insurer in DEFAULT_INSURERS:
            _ensure_named_row(
                connection,
                table="insurers",
                organization_id=organization_id,
                name=insurer,
                with_active=True,
            )

        historical_branches = connection.execute(
            sa.text(
                "SELECT DISTINCT branch FROM claims "
                "WHERE organization_id = :organization_id AND trim(branch) <> ''"
            ),
            {"organization_id": organization_id},
        ).scalars()
        for branch in historical_branches:
            _ensure_named_row(
                connection,
                table="claim_branches",
                organization_id=organization_id,
                name=branch,
                with_active=True,
            )

        historical_insurers = connection.execute(
            sa.text(
                "SELECT DISTINCT insurer FROM claims "
                "WHERE organization_id = :organization_id AND trim(insurer) <> ''"
            ),
            {"organization_id": organization_id},
        ).scalars()
        for insurer in historical_insurers:
            _ensure_named_row(
                connection,
                table="insurers",
                organization_id=organization_id,
                name=insurer,
                with_active=True,
            )

    connection.execute(
        sa.text(
            "UPDATE claims AS c SET branch_id = b.id "
            "FROM claim_branches AS b "
            "WHERE b.organization_id = c.organization_id "
            "AND lower(b.name) = lower(c.branch)"
        )
    )
    connection.execute(
        sa.text(
            "UPDATE claims AS c SET insurer_id = i.id "
            "FROM insurers AS i "
            "WHERE i.organization_id = c.organization_id "
            "AND lower(i.name) = lower(c.insurer)"
        )
    )

    op.alter_column("claims", "branch_id", nullable=False)
    op.alter_column("claims", "insurer_id", nullable=False)
    op.create_foreign_key(
        "fk_claims_branch_id_claim_branches",
        "claims",
        "claim_branches",
        ["branch_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_claims_insurer_id_insurers",
        "claims",
        "insurers",
        ["insurer_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_claims_workshop_id_claim_workshops",
        "claims",
        "claim_workshops",
        ["workshop_id"],
        ["id"],
    )
    op.create_index(
        "ix_claims_org_branch_id", "claims", ["organization_id", "branch_id"]
    )
    op.create_index(
        "ix_claims_org_insurer_id", "claims", ["organization_id", "insurer_id"]
    )
    op.create_index(
        "ix_claims_org_workshop_id", "claims", ["organization_id", "workshop_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_claims_org_workshop_id", table_name="claims")
    op.drop_index("ix_claims_org_insurer_id", table_name="claims")
    op.drop_index("ix_claims_org_branch_id", table_name="claims")
    op.drop_constraint(
        "fk_claims_workshop_id_claim_workshops", "claims", type_="foreignkey"
    )
    op.drop_constraint("fk_claims_insurer_id_insurers", "claims", type_="foreignkey")
    op.drop_constraint(
        "fk_claims_branch_id_claim_branches", "claims", type_="foreignkey"
    )
    op.drop_column("claims", "workshop_id")
    op.drop_column("claims", "insurer_id")
    op.drop_column("claims", "branch_id")
    op.drop_table("claim_workshop_insurers")
    op.drop_index("ix_claim_workshops_org_name", table_name="claim_workshops")
    op.drop_table("claim_workshops")
    op.drop_index("ix_claim_branches_org_name", table_name="claim_branches")
    op.drop_table("claim_branches")
