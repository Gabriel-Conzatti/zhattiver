"""add claims module

Revision ID: 7d2f4c8a91be
Revises: 6c9e0b4d7a12
Create Date: 2026-10-16 00:00:00
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "7d2f4c8a91be"
down_revision: str | Sequence[str] | None = "6c9e0b4d7a12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "claim_statuses",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_terminal", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "slug", name="uq_claim_statuses_org_slug"),
    )
    op.create_index("ix_claim_statuses_org_order", "claim_statuses", ["organization_id", "sort_order"])
    op.create_table(
        "claims",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("status_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("team_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("responsible_user_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("lead_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("opportunity_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("sale_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("claim_number", sa.String(length=100), nullable=True),
        sa.Column("branch", sa.String(length=80), nullable=False),
        sa.Column("insurer", sa.String(length=160), nullable=False),
        sa.Column("service_type", sa.String(length=120), nullable=True),
        sa.Column("has_third_party", sa.Boolean(), nullable=False),
        sa.Column("workshop", sa.String(length=200), nullable=True),
        sa.Column("opened_on", sa.Date(), nullable=False),
        sa.Column("expected_on", sa.Date(), nullable=True),
        sa.Column("concluded_on", sa.Date(), nullable=True),
        sa.Column("closed_on", sa.Date(), nullable=True),
        sa.Column("indemnified_on", sa.Date(), nullable=True),
        sa.Column("indemnified_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["status_id"], ["claim_statuses.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["responsible_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"]),
        sa.ForeignKeyConstraint(["opportunity_id"], ["opportunities.id"]),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"]),
        sa.CheckConstraint(
            "indemnified_amount IS NULL OR indemnified_amount >= 0",
            name="ck_claims_indemnified_amount_nonnegative",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, columns in (
        ("ix_claims_org_status", ["organization_id", "status_id"]),
        ("ix_claims_org_opened", ["organization_id", "opened_on"]),
        ("ix_claims_org_team", ["organization_id", "team_id"]),
        ("ix_claims_org_responsible", ["organization_id", "responsible_user_id"]),
        ("ix_claims_org_insurer", ["organization_id", "insurer"]),
    ):
        op.create_index(name, "claims", columns)
    op.create_table(
        "claim_parties",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("claim_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_claim_parties_claim_role", "claim_parties", ["claim_id", "role"])
    op.create_table(
        "claim_events",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("claim_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("actor_user_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_claim_events_claim_time", "claim_events", ["claim_id", "occurred_at"])
    op.create_table(
        "claim_tasks",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("claim_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("owner_user_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_claim_tasks_org_due", "claim_tasks", ["organization_id", "due_on", "done_at"])
    op.create_index("ix_claim_tasks_claim", "claim_tasks", ["claim_id", "done_at"])
    op.create_table(
        "claim_documents",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("claim_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("uploaded_by", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("size_bytes >= 0", name="ck_claim_documents_size_nonnegative"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["claim_id"], ["claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "storage_key",
            name="uq_claim_documents_org_storage_key",
        ),
    )
    op.create_index(
        "ix_claim_documents_claim",
        "claim_documents",
        ["claim_id", "archived_at"],
    )

    organizations = sa.table("organizations", sa.column("id", sa.UUID(as_uuid=False)))
    statuses = sa.table(
        "claim_statuses",
        sa.column("id", sa.UUID(as_uuid=False)),
        sa.column("organization_id", sa.UUID(as_uuid=False)),
        sa.column("name", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_terminal", sa.Boolean()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    defaults = (
        ("Em acompanhamento", "em_acompanhamento", False),
        ("Verificar", "verificar", False),
        ("Aguardando seguradora", "aguardando_seguradora", False),
        ("Aguardando terceiro", "aguardando_terceiro", False),
        ("Concluído", "concluido", True),
        ("Finalizado", "finalizado", True),
    )
    now = datetime.now(UTC)
    rows = []
    for organization_id in op.get_bind().execute(sa.select(organizations.c.id)).scalars():
        rows.extend(
            {
                "id": str(uuid4()),
                "organization_id": organization_id,
                "name": name,
                "slug": slug,
                "sort_order": index,
                "is_terminal": terminal,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            for index, (name, slug, terminal) in enumerate(defaults)
        )
    if rows:
        op.bulk_insert(statuses, rows)


def downgrade() -> None:
    op.drop_index("ix_claim_documents_claim", table_name="claim_documents")
    op.drop_table("claim_documents")
    op.drop_index("ix_claim_tasks_claim", table_name="claim_tasks")
    op.drop_index("ix_claim_tasks_org_due", table_name="claim_tasks")
    op.drop_table("claim_tasks")
    op.drop_index("ix_claim_events_claim_time", table_name="claim_events")
    op.drop_table("claim_events")
    op.drop_index("ix_claim_parties_claim_role", table_name="claim_parties")
    op.drop_table("claim_parties")
    for name in (
        "ix_claims_org_insurer",
        "ix_claims_org_responsible",
        "ix_claims_org_team",
        "ix_claims_org_opened",
        "ix_claims_org_status",
    ):
        op.drop_index(name, table_name="claims")
    op.drop_table("claims")
    op.drop_index("ix_claim_statuses_org_order", table_name="claim_statuses")
    op.drop_table("claim_statuses")
