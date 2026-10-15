from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk
from ..catalog.models import Insurer

CLAIM_STATUS_FOLLOW_UP = "em_acompanhamento"
CLAIM_STATUS_VERIFY = "verificar"
CLAIM_STATUS_INSURER = "aguardando_seguradora"
CLAIM_STATUS_THIRD_PARTY = "aguardando_terceiro"
CLAIM_STATUS_COMPLETED = "concluido"
CLAIM_STATUS_CLOSED = "finalizado"
CLAIM_STATUSES = (
    CLAIM_STATUS_FOLLOW_UP,
    CLAIM_STATUS_VERIFY,
    CLAIM_STATUS_INSURER,
    CLAIM_STATUS_THIRD_PARTY,
    CLAIM_STATUS_COMPLETED,
    CLAIM_STATUS_CLOSED,
)


class ClaimBranch(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "claim_branches"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_claim_branches_org_name", "organization_id", "name", unique=True),
    )


claim_workshop_insurers = db.Table(
    "claim_workshop_insurers",
    db.Column(
        "workshop_id",
        UUID(as_uuid=False),
        ForeignKey("claim_workshops.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "insurer_id",
        UUID(as_uuid=False),
        ForeignKey("insurers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class ClaimWorkshop(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "claim_workshops"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    responsible_name: Mapped[str] = mapped_column(String(200), nullable=False)
    insurers = relationship(Insurer, secondary=claim_workshop_insurers)

    __table_args__ = (
        Index("ix_claim_workshops_org_name", "organization_id", "name", unique=True),
    )


class ClaimStatus(db.Model, TimestampMixin):
    __tablename__ = "claim_statuses"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    is_terminal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_claim_statuses_org_slug"),
        Index("ix_claim_statuses_org_order", "organization_id", "sort_order"),
    )


class Claim(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "claims"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    status_id: Mapped[str] = uuid_fk("claim_statuses.id")
    branch_id: Mapped[str] = uuid_fk("claim_branches.id")
    insurer_id: Mapped[str] = uuid_fk("insurers.id")
    workshop_id: Mapped[str | None] = uuid_fk("claim_workshops.id", nullable=True)
    team_id: Mapped[str | None] = uuid_fk("teams.id", nullable=True)
    responsible_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    lead_id: Mapped[str | None] = uuid_fk("leads.id", nullable=True)
    opportunity_id: Mapped[str | None] = uuid_fk("opportunities.id", nullable=True)
    sale_id: Mapped[str | None] = uuid_fk("sales.id", nullable=True)
    claim_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    branch: Mapped[str] = mapped_column(String(80), nullable=False)
    insurer: Mapped[str] = mapped_column(String(160), nullable=False)
    service_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    has_third_party: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    workshop: Mapped[str | None] = mapped_column(String(200), nullable=True)
    opened_on: Mapped[date] = mapped_column(Date, nullable=False)
    expected_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    concluded_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    closed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    indemnified_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    indemnified_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "indemnified_amount IS NULL OR indemnified_amount >= 0",
            name="ck_claims_indemnified_amount_nonnegative",
        ),
        Index("ix_claims_org_status", "organization_id", "status_id"),
        Index("ix_claims_org_opened", "organization_id", "opened_on"),
        Index("ix_claims_org_team", "organization_id", "team_id"),
        Index("ix_claims_org_responsible", "organization_id", "responsible_user_id"),
        Index("ix_claims_org_insurer", "organization_id", "insurer"),
        Index("ix_claims_org_branch_id", "organization_id", "branch_id"),
        Index("ix_claims_org_insurer_id", "organization_id", "insurer_id"),
        Index("ix_claims_org_workshop_id", "organization_id", "workshop_id"),
    )


class ClaimParty(db.Model, TimestampMixin):
    __tablename__ = "claim_parties"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    claim_id: Mapped[str] = uuid_fk("claims.id", ondelete="CASCADE")
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    __table_args__ = (
        Index("ix_claim_parties_claim_role", "claim_id", "role"),
    )


class ClaimEvent(db.Model):
    __tablename__ = "claim_events"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    claim_id: Mapped[str] = uuid_fk("claims.id", ondelete="CASCADE")
    actor_user_id: Mapped[str] = uuid_fk("users.id")
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_claim_events_claim_time", "claim_id", "occurred_at"),
    )


class ClaimTask(db.Model, TimestampMixin):
    __tablename__ = "claim_tasks"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    claim_id: Mapped[str] = uuid_fk("claims.id", ondelete="CASCADE")
    owner_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    due_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_claim_tasks_org_due", "organization_id", "due_on", "done_at"),
        Index("ix_claim_tasks_claim", "claim_id", "done_at"),
    )


class ClaimDocument(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "claim_documents"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    claim_id: Mapped[str] = uuid_fk("claims.id", ondelete="CASCADE")
    uploaded_by: Mapped[str] = uuid_fk("users.id")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="ck_claim_documents_size_nonnegative"),
        UniqueConstraint(
            "organization_id",
            "storage_key",
            name="uq_claim_documents_org_storage_key",
        ),
        Index("ix_claim_documents_claim", "claim_id", "archived_at"),
    )
