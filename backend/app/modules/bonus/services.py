from __future__ import annotations

import calendar as _calendar
from dataclasses import dataclass
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import and_, func, select

from ...core.audit import record as audit_record
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..sales.models import (
    CANCEL_AFTER_BONUS,
    STATE_CANCELLED,
    STATE_VALIDATED,
    Sale,
)
from .models import (
    BONUS_KIND_FIXED,
    BONUS_KIND_PERCENT,
    METRIC_COUNT,
    METRIC_NET_PREMIUM,
    PAY_STATE_APPROVED,
    PAY_STATE_CANCELLED,
    PAY_STATE_PAID,
    PAY_STATE_PREDICTED,
    BonusPayment,
    BonusRule,
    MonthlyGoal,
)


@dataclass(frozen=True)
class BonusResult:
    year: int
    month: int
    metric_base: str
    metric_value: Decimal
    amount: Decimal
    applied_rule_id: str | None
    applied_rule_snapshot: dict[str, Any] | None


def predicted_payment_date(year: int, month: int) -> date:
    """RN-039: dia 20 do mês seguinte à produção."""
    next_month = month + 1
    next_year = year
    if next_month > 12:
        next_month = 1
        next_year += 1
    return date(next_year, next_month, 20)


def month_bounds(year: int, month: int) -> tuple[date, date]:
    _, last = _calendar.monthrange(year, month)
    return date(year, month, 1), date(year, month, last)


def _validated_sales_query(*, organization_id: str, user_id: str, product_id: str, year: int, month: int):
    start, end = month_bounds(year, month)
    return (
        select(Sale)
        .where(
            Sale.organization_id == organization_id,
            Sale.seller_user_id == user_id,
            Sale.product_id == product_id,
            Sale.closed_on >= start,
            Sale.closed_on <= end,
            Sale.state == STATE_VALIDATED,
        )
    )


def _eligible_sales(
    *, organization_id: str, user_id: str, product_id: str, year: int, month: int,
    include_bonus_paid_cancels: bool = False,
) -> list[Sale]:
    """RN-038/040/041/042: apenas validadas contam.

    - Cancelamentos antes do pagamento saem imediatamente da produção considerada.
    - Cancelamentos depois do pagamento preservam o pagamento histórico (não recalculam
      o snapshot pago), mas apurações vivas passam a ignorar a venda.
    """
    start, end = month_bounds(year, month)
    stmt = select(Sale).where(
        Sale.organization_id == organization_id,
        Sale.seller_user_id == user_id,
        Sale.product_id == product_id,
        Sale.closed_on >= start,
        Sale.closed_on <= end,
    )
    sales = db.session.execute(stmt).scalars().all()
    result: list[Sale] = []
    for s in sales:
        if s.state == STATE_VALIDATED:
            result.append(s)
    return result


def _find_rule(
    *, organization_id: str, product_id: str, base: str, value: Decimal, on: date
) -> BonusRule | None:
    stmt = select(BonusRule).where(
        BonusRule.organization_id == organization_id,
        BonusRule.product_id == product_id,
        BonusRule.base == base,
        BonusRule.effective_from <= on,
        (BonusRule.effective_to.is_(None)) | (BonusRule.effective_to >= on),
        BonusRule.bracket_min <= value,
        (BonusRule.bracket_max.is_(None)) | (BonusRule.bracket_max >= value),
    ).order_by(BonusRule.bracket_min.desc())
    return db.session.execute(stmt).scalars().first()


def _apply_rule(rule: BonusRule, metric_value: Decimal) -> Decimal:
    if rule.bonus_kind == BONUS_KIND_FIXED:
        return Decimal(rule.value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if rule.bonus_kind == BONUS_KIND_PERCENT:
        return (Decimal(rule.value) * metric_value).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    return Decimal("0")


def compute_bonus_for_month(
    *,
    organization_id: str,
    user_id: str,
    product_id: str,
    year: int,
    month: int,
    metric_base: str = METRIC_NET_PREMIUM,
) -> BonusResult:
    """Apura a metric (net_premium ou count) e escolhe a faixa vigente."""
    if metric_base not in (METRIC_COUNT, METRIC_NET_PREMIUM):
        raise BusinessError("invalid_metric", "Base inválida", status=422)
    sales = _eligible_sales(
        organization_id=organization_id,
        user_id=user_id,
        product_id=product_id,
        year=year,
        month=month,
    )
    if metric_base == METRIC_COUNT:
        metric_value = Decimal(len(sales))
    else:
        metric_value = sum((s.net_premium for s in sales), Decimal("0"))

    last_day = month_bounds(year, month)[1]
    rule = _find_rule(
        organization_id=organization_id,
        product_id=product_id,
        base=metric_base,
        value=metric_value,
        on=last_day,
    )
    if rule is None:
        return BonusResult(
            year=year,
            month=month,
            metric_base=metric_base,
            metric_value=metric_value,
            amount=Decimal("0"),
            applied_rule_id=None,
            applied_rule_snapshot=None,
        )
    amount = _apply_rule(rule, metric_value)
    snapshot = {
        "rule_id": str(rule.id),
        "name": rule.name,
        "base": rule.base,
        "bracket_min": str(rule.bracket_min),
        "bracket_max": str(rule.bracket_max) if rule.bracket_max is not None else None,
        "bonus_kind": rule.bonus_kind,
        "value": str(rule.value),
        "effective_from": rule.effective_from.isoformat(),
        "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
    }
    return BonusResult(
        year=year,
        month=month,
        metric_base=metric_base,
        metric_value=metric_value,
        amount=amount,
        applied_rule_id=str(rule.id),
        applied_rule_snapshot=snapshot,
    )


def next_bracket_hint(
    *, organization_id: str, product_id: str, base: str, current: Decimal, on: date
) -> dict[str, Any] | None:
    """Faixa imediatamente acima da atual (para o "faltam X" do dashboard)."""
    stmt = select(BonusRule).where(
        BonusRule.organization_id == organization_id,
        BonusRule.product_id == product_id,
        BonusRule.base == base,
        BonusRule.effective_from <= on,
        (BonusRule.effective_to.is_(None)) | (BonusRule.effective_to >= on),
        BonusRule.bracket_min > current,
    ).order_by(BonusRule.bracket_min.asc())
    rule = db.session.execute(stmt).scalars().first()
    if rule is None:
        return None
    return {
        "name": rule.name,
        "bracket_min": str(rule.bracket_min),
        "missing": str(Decimal(rule.bracket_min) - current),
        "bonus_kind": rule.bonus_kind,
        "value": str(rule.value),
    }


# --- Pagamento ---------------------------------------------------------------

def get_or_create_prediction(
    *,
    organization_id: str,
    user_id: str,
    product_id: str,
    year: int,
    month: int,
    metric_base: str,
) -> BonusPayment:
    """Retorna ou cria o registro de bônus previsto para o par (vendedor, produto, mês)."""
    stmt = select(BonusPayment).where(
        BonusPayment.organization_id == organization_id,
        BonusPayment.user_id == user_id,
        BonusPayment.product_id == product_id,
        BonusPayment.year == year,
        BonusPayment.month == month,
    )
    existing = db.session.execute(stmt).scalar_one_or_none()
    result = compute_bonus_for_month(
        organization_id=organization_id,
        user_id=user_id,
        product_id=product_id,
        year=year,
        month=month,
        metric_base=metric_base,
    )
    if existing is None:
        payment = BonusPayment(
            organization_id=organization_id,
            user_id=user_id,
            product_id=product_id,
            year=year,
            month=month,
            predicted_on=predicted_payment_date(year, month),
            metric_base=result.metric_base,
            metric_value=result.metric_value,
            amount=result.amount,
            applied_rule_id=result.applied_rule_id,
            applied_rule_snapshot=result.applied_rule_snapshot,
            state=PAY_STATE_PREDICTED,
        )
        db.session.add(payment)
        db.session.flush()
        return payment
    # Enquanto previsto/aprovado, o snapshot é mantido em dia.
    if existing.state in (PAY_STATE_PREDICTED, PAY_STATE_APPROVED):
        existing.metric_base = result.metric_base
        existing.metric_value = result.metric_value
        existing.amount = result.amount
        existing.applied_rule_id = result.applied_rule_id
        existing.applied_rule_snapshot = result.applied_rule_snapshot
    return existing


def approve_bonus(
    *,
    organization_id: str,
    actor_user_id: str,
    payment: BonusPayment,
    request_id: str | None = None,
) -> BonusPayment:
    if payment.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if payment.state == PAY_STATE_PAID:
        raise BusinessError("invalid_state", "Bônus já pago", status=409)
    payment.state = PAY_STATE_APPROVED
    payment.approved_at = now_utc()
    payment.approved_by = actor_user_id
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="bonus_payment",
        entity_id=str(payment.id),
        action="approve",
        request_id=request_id,
    )
    return payment


def mark_bonus_paid(
    *,
    organization_id: str,
    actor_user_id: str,
    payment: BonusPayment,
    paid_amount: Decimal | None = None,
    request_id: str | None = None,
) -> BonusPayment:
    """RN-039/041: registra pagamento efetivo; snapshot vira imutável após pagamento."""
    if payment.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if payment.state == PAY_STATE_PAID:
        return payment
    payment.state = PAY_STATE_PAID
    payment.paid_at = now_utc()
    payment.paid_amount = paid_amount if paid_amount is not None else payment.amount
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="bonus_payment",
        entity_id=str(payment.id),
        action="pay",
        after={"paid_amount": str(payment.paid_amount)},
        request_id=request_id,
    )
    return payment


def bonus_paid_for_sale_month(*, organization_id: str, user_id: str, product_id: str, year: int, month: int) -> bool:
    """Verifica se o bônus daquele mês/produto/vendedor já foi pago — para RN-040/041."""
    stmt = select(BonusPayment).where(
        BonusPayment.organization_id == organization_id,
        BonusPayment.user_id == user_id,
        BonusPayment.product_id == product_id,
        BonusPayment.year == year,
        BonusPayment.month == month,
    )
    payment = db.session.execute(stmt).scalar_one_or_none()
    return payment is not None and payment.state == PAY_STATE_PAID


# --- Metas mensais ----------------------------------------------------------

def get_monthly_goal(
    *,
    organization_id: str,
    user_id: str,
    product_id: str | None,
    year: int,
    month: int,
) -> MonthlyGoal | None:
    stmt = select(MonthlyGoal).where(
        MonthlyGoal.organization_id == organization_id,
        MonthlyGoal.user_id == user_id,
        MonthlyGoal.year == year,
        MonthlyGoal.month == month,
    )
    if product_id is None:
        stmt = stmt.where(MonthlyGoal.product_id.is_(None))
    else:
        stmt = stmt.where(MonthlyGoal.product_id == product_id)
    return db.session.execute(stmt).scalar_one_or_none()


def month_sales_summary(
    *, organization_id: str, user_id: str, product_id: str | None, year: int, month: int
) -> dict[str, Decimal | int]:
    start, end = month_bounds(year, month)
    stmt = select(
        func.count(Sale.id),
        func.coalesce(func.sum(Sale.net_premium), Decimal("0")),
        func.coalesce(func.sum(Sale.commission_amount), Decimal("0")),
    ).where(
        Sale.organization_id == organization_id,
        Sale.seller_user_id == user_id,
        Sale.closed_on >= start,
        Sale.closed_on <= end,
        Sale.state == STATE_VALIDATED,
    )
    if product_id:
        stmt = stmt.where(Sale.product_id == product_id)
    total_count, total_net, total_comm = db.session.execute(stmt).one()
    return {
        "count": int(total_count or 0),
        "net_premium": Decimal(total_net or 0),
        "commission_amount": Decimal(total_comm or 0),
    }
