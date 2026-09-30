from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk

METRIC_COUNT = "count"
METRIC_NET_PREMIUM = "net_premium"
METRIC_INSTALLMENT = "installment"
METRICS = (METRIC_COUNT, METRIC_NET_PREMIUM, METRIC_INSTALLMENT)


class MonthlyGoal(db.Model, TimestampMixin):
    """Meta mensal por vendedor/produto com competência (RN-043/044)."""

    __tablename__ = "monthly_goals"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    product_id: Mapped[str | None] = uuid_fk("products.id", nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    target_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_net_premium: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0")
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            "product_id",
            "year",
            "month",
            name="uq_monthly_goals_scope",
        ),
    )


BONUS_KIND_FIXED = "fixed"
BONUS_KIND_PERCENT = "percent"


class BonusRule(db.Model, TimestampMixin):
    """Regras/faixas de bonificação (RN-045..RN-050)."""

    __tablename__ = "bonus_rules"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    product_id: Mapped[str] = uuid_fk("products.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    base: Mapped[str] = mapped_column(String(20), nullable=False, default=METRIC_COUNT)
    bracket_min: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    bracket_max: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    bonus_kind: Mapped[str] = mapped_column(String(10), nullable=False, default=BONUS_KIND_FIXED)
    value: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("ix_bonus_rules_product_base", "product_id", "base"),
    )


PAY_STATE_PREDICTED = "predicted"
PAY_STATE_APPROVED = "approved"
PAY_STATE_PAID = "paid"
PAY_STATE_CANCELLED = "cancelled"
PAYMENT_STATES = (PAY_STATE_PREDICTED, PAY_STATE_APPROVED, PAY_STATE_PAID, PAY_STATE_CANCELLED)


class BonusPayment(db.Model, TimestampMixin):
    """Snapshot do bônus mensal por vendedor/produto (RN-039..RN-042)."""

    __tablename__ = "bonus_payments"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    product_id: Mapped[str] = uuid_fk("products.id")
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    predicted_on: Mapped[date] = mapped_column(Date, nullable=False)
    metric_base: Mapped[str] = mapped_column(String(20), nullable=False)
    metric_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    applied_rule_id: Mapped[str | None] = uuid_fk("bonus_rules.id", nullable=True)
    applied_rule_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=PAY_STATE_PREDICTED)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = uuid_fk("users.id", nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "user_id",
            "product_id",
            "year",
            "month",
            name="uq_bonus_payments_scope",
        ),
    )
