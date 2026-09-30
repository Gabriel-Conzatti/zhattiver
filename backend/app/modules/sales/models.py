from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk

STATE_REGISTERED = "registered"
STATE_VALIDATED = "validated"
STATE_REVISION_PENDING = "revision_pending"
STATE_CANCELLED = "cancelled"
SALE_STATES = (STATE_REGISTERED, STATE_VALIDATED, STATE_REVISION_PENDING, STATE_CANCELLED)

CANCEL_BEFORE_BONUS = "before_bonus"
CANCEL_AFTER_BONUS = "after_bonus"


class Sale(db.Model, TimestampMixin):
    __tablename__ = "sales"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id")
    opportunity_id: Mapped[str | None] = uuid_fk("opportunities.id", nullable=True)
    product_id: Mapped[str] = uuid_fk("products.id")
    seller_user_id: Mapped[str] = uuid_fk("users.id")
    insurer_id: Mapped[str] = uuid_fk("insurers.id")
    client_type_id: Mapped[str] = uuid_fk("client_types.id")
    net_premium: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    closed_on: Mapped[date] = mapped_column(Date, nullable=False)
    origin: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    edit_deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=STATE_REGISTERED)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_by: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cancelled_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        Index("ix_sales_org_closed_state", "organization_id", "closed_on", "state"),
        Index("ix_sales_seller_closed", "seller_user_id", "closed_on"),
    )


class SaleRevision(db.Model, TimestampMixin):
    """RN-034: alteração pelo vendedor mantém a versão validada anterior até nova aprovação."""

    __tablename__ = "sale_revisions"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    sale_id: Mapped[str] = uuid_fk("sales.id", ondelete="CASCADE")
    submitted_by: Mapped[str] = uuid_fk("users.id")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    reviewed_by: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_sale_revisions_sale_state", "sale_id", "state"),
    )
