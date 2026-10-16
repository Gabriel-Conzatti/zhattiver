"""ajustar sinistros e funil

Revision ID: e5b2a9c4d871
Revises: b4c91e8d2f60
Create Date: 2026-10-16 15:10:00
"""

import re
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "e5b2a9c4d871"
down_revision: str | Sequence[str] | None = "b4c91e8d2f60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_INSURERS = ("Yelum Affinity",)
# Auto já existe como "Seguro Automóvel" (slug "auto") e é reaproveitado.
PRODUCTS = (
    ("Auto", "auto"),
    ("Vida", None),
    ("Residência", None),
    ("Empresarial", None),
    ("Vida em Grupo", None),
    ("Transporte", None),
    ("Responsabilidade Civil", None),
    ("Equipamentos Energia Solar", None),
    ("Equipamentos Rural", None),
    ("Frota", None),
)
# Fotografia das etapas padrão de `app/cli` no momento desta migration.
DEFAULT_STAGES = (
    (
        "Mensagem inicial",
        True,
        False,
        "Olá {nome_cliente}, aqui é {nome_vendedor} da corretora. "
        "Podemos falar sobre seu seguro?",
    ),
    ("Questionário", False, False, None),
    ("Negociação", False, False, None),
    ("Reengajamento", False, False, None),
    ("Finalização", False, False, None),
    ("Transmitido", False, True, None),
)
BRANCH_ITEM_TYPES = (
    ("auto", "vehicle"),
    ("rco onibus", "vehicle"),
    ("re", "property"),
)


def _slug(value: str) -> str:
    # Mesmo algoritmo de `catalog.routes._slug`, para reconhecer cadastros manuais.
    v = value.strip().lower()
    v = re.sub(r"[^\w]+", "-", v, flags=re.UNICODE)
    return v.strip("-")


def _seed_insurers(connection, organization_id: str) -> None:
    for name in NEW_INSURERS:
        exists = connection.execute(
            sa.text(
                "SELECT 1 FROM insurers "
                "WHERE organization_id = :organization_id AND lower(name) = lower(:name)"
            ),
            {"organization_id": organization_id, "name": name},
        ).first()
        if exists:
            continue
        connection.execute(
            sa.text(
                "INSERT INTO insurers "
                "(id, organization_id, name, is_active, created_at, updated_at) "
                "VALUES (:id, :organization_id, :name, true, now(), now())"
            ),
            {"id": str(uuid4()), "organization_id": organization_id, "name": name},
        )


def _seed_products(connection, organization_id: str) -> None:
    for name, fixed_slug in PRODUCTS:
        slug = fixed_slug or _slug(name)
        product_id = connection.execute(
            sa.text(
                "SELECT id FROM products WHERE organization_id = :organization_id "
                "AND (slug = :slug OR lower(name) = lower(:name)) LIMIT 1"
            ),
            {"organization_id": organization_id, "slug": slug, "name": name},
        ).scalar_one_or_none()
        if product_id is None:
            product_id = str(uuid4())
            connection.execute(
                sa.text(
                    "INSERT INTO products "
                    "(id, organization_id, name, slug, is_active, created_at, updated_at) "
                    "VALUES (:id, :organization_id, :name, :slug, true, now(), now())"
                ),
                {
                    "id": product_id,
                    "organization_id": organization_id,
                    "name": name,
                    "slug": slug,
                },
            )
        has_funnel = connection.execute(
            sa.text(
                "SELECT 1 FROM funnels "
                "WHERE organization_id = :organization_id AND product_id = :product_id"
            ),
            {"organization_id": organization_id, "product_id": str(product_id)},
        ).first()
        if has_funnel:
            continue
        funnel_id = str(uuid4())
        connection.execute(
            sa.text(
                "INSERT INTO funnels "
                "(id, organization_id, product_id, name, is_default, created_at, updated_at) "
                "VALUES (:id, :organization_id, :product_id, :name, true, now(), now())"
            ),
            {
                "id": funnel_id,
                "organization_id": organization_id,
                "product_id": str(product_id),
                "name": f"Funil {name}",
            },
        )
        for index, (stage_name, is_initial, is_final, template) in enumerate(
            DEFAULT_STAGES
        ):
            connection.execute(
                sa.text(
                    "INSERT INTO funnel_stages "
                    "(id, organization_id, funnel_id, name, order_index, is_initial, "
                    "is_final, message_template, created_at, updated_at) "
                    "VALUES (:id, :organization_id, :funnel_id, :name, :order_index, "
                    ":is_initial, :is_final, :template, now(), now())"
                ),
                {
                    "id": str(uuid4()),
                    "organization_id": organization_id,
                    "funnel_id": funnel_id,
                    "name": stage_name,
                    "order_index": index,
                    "is_initial": is_initial,
                    "is_final": is_final,
                    "template": template,
                },
            )


def upgrade() -> None:
    op.add_column(
        "claim_branches", sa.Column("item_type", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "claim_workshops", sa.Column("city", sa.String(length=120), nullable=True)
    )
    op.add_column(
        "claim_parties", sa.Column("document", sa.String(length=20), nullable=True)
    )
    for column in (
        sa.Column("vehicle_plate", sa.String(length=10), nullable=True),
        sa.Column("vehicle_model", sa.String(length=120), nullable=True),
        sa.Column("vehicle_year", sa.Integer(), nullable=True),
        sa.Column("property_address", sa.String(length=500), nullable=True),
        sa.Column("coverage", sa.String(length=120), nullable=True),
    ):
        op.add_column("claims", column)
    op.create_table(
        "claim_insurer_profiles",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("insurer_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("contacts", sa.Text(), nullable=True),
        sa.Column("rental_car_contact", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.UUID(as_uuid=False), nullable=True),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["insurer_id"], ["insurers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "organization_id",
            "insurer_id",
            name="uq_claim_insurer_profiles_org_insurer",
        ),
    )

    op.add_column("leads", sa.Column("postal_code", sa.String(length=9), nullable=True))
    op.add_column(
        "import_rows", sa.Column("lead_id", sa.UUID(as_uuid=False), nullable=True)
    )
    op.create_foreign_key(
        "fk_import_rows_lead_id_leads", "import_rows", "leads", ["lead_id"], ["id"]
    )
    op.create_table(
        "lead_deletion_requests",
        sa.Column("id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("organization_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("lead_id", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("import_batch_id", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("requested_by", sa.UUID(as_uuid=False), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reviewed_by", sa.UUID(as_uuid=False), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["import_batch_id"], ["import_batches.id"]),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_lead_deletion_requests_org_status",
        "lead_deletion_requests",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_lead_deletion_requests_lead", "lead_deletion_requests", ["lead_id"]
    )

    connection = op.get_bind()
    for name, item_type in BRANCH_ITEM_TYPES:
        connection.execute(
            sa.text(
                "UPDATE claim_branches SET item_type = :item_type "
                "WHERE lower(name) = :name AND item_type IS NULL"
            ),
            {"name": name, "item_type": item_type},
        )
    organization_ids = connection.execute(
        sa.text("SELECT id FROM organizations")
    ).scalars().all()
    for organization_id in organization_ids:
        _seed_insurers(connection, str(organization_id))
        _seed_products(connection, str(organization_id))


def downgrade() -> None:
    # Produtos, funis e seguradoras semeados permanecem: podem já ter vendas,
    # oportunidades ou sinistros vinculados.
    op.drop_index("ix_lead_deletion_requests_lead", table_name="lead_deletion_requests")
    op.drop_index(
        "ix_lead_deletion_requests_org_status", table_name="lead_deletion_requests"
    )
    op.drop_table("lead_deletion_requests")
    op.drop_constraint("fk_import_rows_lead_id_leads", "import_rows", type_="foreignkey")
    op.drop_column("import_rows", "lead_id")
    op.drop_column("leads", "postal_code")
    op.drop_table("claim_insurer_profiles")
    for column in (
        "coverage",
        "property_address",
        "vehicle_year",
        "vehicle_model",
        "vehicle_plate",
    ):
        op.drop_column("claims", column)
    op.drop_column("claim_parties", "document")
    op.drop_column("claim_workshops", "city")
    op.drop_column("claim_branches", "item_type")
