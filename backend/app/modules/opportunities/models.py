from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk

STATE_OPEN = "open"
STATE_WON = "won"
STATE_LOST = "lost"
OPPORTUNITY_STATES = (STATE_OPEN, STATE_WON, STATE_LOST)


class Opportunity(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "opportunities"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    product_id: Mapped[str] = uuid_fk("products.id")
    funnel_id: Mapped[str] = uuid_fk("funnels.id")
    current_stage_id: Mapped[str] = uuid_fk("funnel_stages.id")
    owner_user_id: Mapped[str] = uuid_fk("users.id")
    state: Mapped[str] = mapped_column(String(10), nullable=False, default=STATE_OPEN)
    origin: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_availability_id: Mapped[str | None] = uuid_fk("availabilities.id", nullable=True)
    source_schedule_id: Mapped[str | None] = uuid_fk("schedules.id", nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_relevant_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    loss_reason_id: Mapped[str | None] = uuid_fk("loss_reasons.id", nullable=True)
    loss_justification: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    recycled_to_schedule_id: Mapped[str | None] = uuid_fk("schedules.id", nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_opportunities_owner_state", "owner_user_id", "state"),
        Index("ix_opportunities_org_state", "organization_id", "state"),
        # Unicidade de oportunidade aberta por (org, lead, produto) — decisão provisória
        Index(
            "uq_opportunities_open_unique",
            "organization_id",
            "lead_id",
            "product_id",
            unique=True,
            postgresql_where=db.text("state = 'open'"),
        ),
    )


TYPE_COPY_MESSAGE = "copy_message"
TYPE_CONTACT = "contact"
TYPE_CALL = "call"
TYPE_NOTE = "note"
TYPE_RESPONSE = "response"
TYPE_STAGE_CHANGE = "stage_change"
TYPE_RESULT = "result"
TYPE_NEXT_ACTION_CREATED = "next_action_created"
TYPE_NEXT_ACTION_DONE = "next_action_done"
TYPE_SCHEDULE_CONTACT = "schedule_contact"
TYPE_SCHEDULE_RESOLVED = "schedule_resolved"

# Atividades que reiniciam o relógio de follow-up (RN-019)
RELEVANT_ACTIVITY_TYPES = frozenset(
    {
        TYPE_COPY_MESSAGE,
        TYPE_CONTACT,
        TYPE_CALL,
        TYPE_RESPONSE,
        TYPE_STAGE_CHANGE,
        TYPE_RESULT,
        TYPE_NEXT_ACTION_CREATED,
        TYPE_SCHEDULE_CONTACT,
    }
)


class Activity(db.Model):
    __tablename__ = "activities"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    opportunity_id: Mapped[str | None] = uuid_fk("opportunities.id", nullable=True)
    lead_id: Mapped[str | None] = uuid_fk("leads.id", nullable=True)
    schedule_id: Mapped[str | None] = uuid_fk("schedules.id", nullable=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    actor_user_id: Mapped[str] = uuid_fk("users.id")
    beneficiary_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    counts_for_daily_metric: Mapped[str | None] = mapped_column(String(40), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_activities_idempotency"),
        Index("ix_activities_opportunity", "opportunity_id", "occurred_at"),
        Index("ix_activities_actor_occurred", "actor_user_id", "occurred_at"),
        Index("ix_activities_metric", "counts_for_daily_metric"),
    )


NA_STATE_OPEN = "open"
NA_STATE_DONE = "done"
NA_STATE_CANCELLED = "cancelled"


class NextAction(db.Model, TimestampMixin):
    __tablename__ = "next_actions"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    opportunity_id: Mapped[str] = uuid_fk("opportunities.id", ondelete="CASCADE")
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    owner_user_id: Mapped[str] = uuid_fk("users.id")
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=NA_STATE_OPEN)
    origin: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    generation_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    done_activity_id: Mapped[str | None] = uuid_fk("activities.id", nullable=True)

    __table_args__ = (
        Index("ix_next_actions_owner_state_due", "owner_user_id", "state", "due_at"),
        UniqueConstraint(
            "organization_id", "generation_key", name="uq_next_actions_generation"
        ),
    )


class LossReason(db.Model, TimestampMixin):
    """Motivo de perda configurável (RN-055)."""

    __tablename__ = "loss_reasons"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        db.Boolean, nullable=False, default=True
    )

    __table_args__ = (
        Index("ix_loss_reasons_org_slug", "organization_id", "slug", unique=True),
    )


class NextActionType(db.Model, TimestampMixin):
    """Tipos de próxima ação configuráveis (RN-022)."""

    __tablename__ = "next_action_types"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        db.Boolean, nullable=False, default=True
    )

    __table_args__ = (
        Index("ix_next_action_types_org_slug", "organization_id", "slug", unique=True),
    )
