from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select

from ...core.audit import record as audit_record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import today_local
from ...extensions import db
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR, Product, User
from . import services
from .models import (
    BONUS_KIND_FIXED,
    BONUS_KIND_PERCENT,
    METRIC_COUNT,
    METRIC_NET_PREMIUM,
    BonusPayment,
    BonusRule,
    MonthlyGoal,
)

bp = Blueprint("bonus", __name__)


# ---- Metas mensais ---------------------------------------------------------

class MonthlyGoalCreate(BaseModel):
    user_id: str
    product_id: str | None = None
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)
    target_count: int = Field(default=0, ge=0)
    target_net_premium: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = Field(default=None, max_length=500)


@bp.get("/monthly-goals")
@login_required
def list_monthly_goals():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    year = int(request.args.get("year", today_local().year))
    month = int(request.args.get("month", today_local().month))
    rows = db.session.execute(
        select(MonthlyGoal).where(
            MonthlyGoal.organization_id == ctx.organization_id,
            MonthlyGoal.year == year,
            MonthlyGoal.month == month,
        )
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(g.id),
                    "user_id": str(g.user_id),
                    "product_id": str(g.product_id) if g.product_id else None,
                    "year": g.year,
                    "month": g.month,
                    "target_count": g.target_count,
                    "target_net_premium": str(g.target_net_premium),
                    "notes": g.notes,
                }
                for g in rows
            ]
        }
    )


@bp.post("/monthly-goals")
@login_required
def create_monthly_goal():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    payload = MonthlyGoalCreate.model_validate(request.get_json(silent=True) or {})
    user = db.session.get(User, payload.user_id)
    if (
        user is None
        or user.organization_id != ctx.organization_id
        or user.role != ROLE_VENDEDOR
    ):
        raise BusinessError("not_found", "Vendedor não encontrado", status=404)
    if payload.product_id is not None:
        product = db.session.get(Product, payload.product_id)
        if product is None or product.organization_id != ctx.organization_id:
            raise BusinessError("not_found", "Produto não encontrado", status=404)
        if all(str(item.id) != payload.product_id for item in user.products):
            raise BusinessError(
                "product_not_assigned",
                "O produto não está associado ao vendedor",
                status=422,
            )
    existing = services.get_monthly_goal(
        organization_id=ctx.organization_id,
        user_id=payload.user_id,
        product_id=payload.product_id,
        year=payload.year,
        month=payload.month,
    )
    before = None
    if existing is not None:
        before = _goal_snapshot(existing)
        existing.target_count = payload.target_count
        existing.target_net_premium = payload.target_net_premium
        existing.notes = payload.notes.strip() if payload.notes else None
        goal = existing
        status = 200
        action = "update"
    else:
        goal = MonthlyGoal(
            organization_id=ctx.organization_id,
            user_id=payload.user_id,
            product_id=payload.product_id,
            year=payload.year,
            month=payload.month,
            target_count=payload.target_count,
            target_net_premium=payload.target_net_premium,
            notes=payload.notes.strip() if payload.notes else None,
        )
        db.session.add(goal)
        db.session.flush()
        status = 201
        action = "create"
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="monthly_goal",
        entity_id=str(goal.id),
        action=action,
        before=before,
        after=_goal_snapshot(goal),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(goal.id)}), status


# ---- Faixas de bônus -------------------------------------------------------

class BonusRuleCreate(BaseModel):
    product_id: str
    name: str = Field(min_length=1, max_length=120)
    base: str
    bracket_min: Decimal = Field(ge=0)
    bracket_max: Decimal | None = None
    bonus_kind: str
    value: Decimal = Field(gt=0)
    effective_from: date
    effective_to: date | None = None


class BonusRuleEnd(BaseModel):
    effective_to: date


@bp.get("/bonus-rules")
@login_required
def list_bonus_rules():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    rows = db.session.execute(
        select(BonusRule).where(BonusRule.organization_id == ctx.organization_id).order_by(
            BonusRule.product_id, BonusRule.base, BonusRule.bracket_min
        )
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(r.id),
                    "product_id": str(r.product_id),
                    "name": r.name,
                    "base": r.base,
                    "bracket_min": str(r.bracket_min),
                    "bracket_max": str(r.bracket_max) if r.bracket_max is not None else None,
                    "bonus_kind": r.bonus_kind,
                    "value": str(r.value),
                    "effective_from": r.effective_from.isoformat(),
                    "effective_to": r.effective_to.isoformat() if r.effective_to else None,
                }
                for r in rows
            ]
        }
    )


@bp.post("/bonus-rules")
@login_required
def create_bonus_rule():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    payload = BonusRuleCreate.model_validate(request.get_json(silent=True) or {})
    if payload.base not in (METRIC_COUNT, METRIC_NET_PREMIUM):
        raise BusinessError("invalid_base", "Base inválida", status=422)
    if payload.bonus_kind not in (BONUS_KIND_FIXED, BONUS_KIND_PERCENT):
        raise BusinessError("invalid_kind", "Tipo de bônus inválido", status=422)
    product = db.session.get(Product, payload.product_id)
    if product is None or product.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Produto não encontrado", status=404)
    if payload.bracket_max is not None and payload.bracket_max <= payload.bracket_min:
        raise BusinessError(
            "invalid_bracket",
            "O limite máximo deve ser maior que o limite mínimo",
            status=422,
        )
    if payload.effective_from.day != 1:
        raise BusinessError(
            "invalid_effective_period",
            "A vigência deve começar no primeiro dia do mês",
            status=422,
        )
    if payload.effective_to is not None:
        last_day = calendar.monthrange(
            payload.effective_to.year, payload.effective_to.month
        )[1]
        if payload.effective_to.day != last_day:
            raise BusinessError(
                "invalid_effective_period",
                "O fim da vigência deve ser o último dia do mês",
                status=422,
            )
        if payload.effective_to < payload.effective_from:
            raise BusinessError(
                "invalid_effective_period",
                "O fim da vigência não pode ser anterior ao início",
                status=422,
            )
    date_overlap = and_(
        BonusRule.effective_from <= (payload.effective_to or date.max),
        or_(
            BonusRule.effective_to.is_(None),
            BonusRule.effective_to >= payload.effective_from,
        ),
    )
    bracket_overlap = and_(
        BonusRule.bracket_min
        < (
            payload.bracket_max
            if payload.bracket_max is not None
            else Decimal("999999999999.99")
        ),
        or_(
            BonusRule.bracket_max.is_(None),
            BonusRule.bracket_max > payload.bracket_min,
        ),
    )
    overlap = db.session.execute(
        select(BonusRule.id).where(
            BonusRule.organization_id == ctx.organization_id,
            BonusRule.product_id == payload.product_id,
            BonusRule.base == payload.base,
            date_overlap,
            bracket_overlap,
        )
    ).first()
    if overlap is not None:
        raise BusinessError(
            "overlapping_bonus_rule",
            "Já existe uma faixa sobreposta para esse produto, base e vigência",
            status=409,
        )
    rule = BonusRule(
        organization_id=ctx.organization_id,
        product_id=payload.product_id,
        name=payload.name.strip(),
        base=payload.base,
        bracket_min=payload.bracket_min,
        bracket_max=payload.bracket_max,
        bonus_kind=payload.bonus_kind,
        value=payload.value,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )
    db.session.add(rule)
    db.session.flush()
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="bonus_rule",
        entity_id=str(rule.id),
        action="create",
        after=_bonus_rule_snapshot(rule),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(rule.id)}), 201


@bp.patch("/bonus-rules/<rule_id>")
@login_required
def end_bonus_rule(rule_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    rule = db.session.get(BonusRule, rule_id)
    if rule is None or rule.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Faixa de bônus não encontrada", status=404)
    if rule.effective_to is not None:
        raise BusinessError(
            "rule_already_ended",
            "A vigência dessa faixa já foi encerrada",
            status=409,
        )
    payload = BonusRuleEnd.model_validate(request.get_json(silent=True) or {})
    last_day = calendar.monthrange(payload.effective_to.year, payload.effective_to.month)[1]
    if payload.effective_to.day != last_day:
        raise BusinessError(
            "invalid_effective_period",
            "O fim da vigência deve ser o último dia do mês",
            status=422,
        )
    current = today_local()
    current_month_end = date(
        current.year,
        current.month,
        calendar.monthrange(current.year, current.month)[1],
    )
    if payload.effective_to < current_month_end:
        raise BusinessError(
            "historical_rule",
            "Não é permitido alterar retroativamente uma faixa de bônus",
            status=422,
        )
    if payload.effective_to < rule.effective_from:
        raise BusinessError(
            "invalid_effective_period",
            "O fim da vigência não pode ser anterior ao início",
            status=422,
        )
    before = _bonus_rule_snapshot(rule)
    rule.effective_to = payload.effective_to
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="bonus_rule",
        entity_id=str(rule.id),
        action="end",
        before=before,
        after=_bonus_rule_snapshot(rule),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(rule.id), "effective_to": rule.effective_to.isoformat()})


def _goal_snapshot(goal: MonthlyGoal) -> dict[str, str | int | None]:
    return {
        "user_id": str(goal.user_id),
        "product_id": str(goal.product_id) if goal.product_id else None,
        "year": goal.year,
        "month": goal.month,
        "target_count": goal.target_count,
        "target_net_premium": str(goal.target_net_premium),
        "notes": goal.notes,
    }


def _bonus_rule_snapshot(rule: BonusRule) -> dict[str, str | None]:
    return {
        "product_id": str(rule.product_id),
        "name": rule.name,
        "base": rule.base,
        "bracket_min": str(rule.bracket_min),
        "bracket_max": str(rule.bracket_max) if rule.bracket_max is not None else None,
        "bonus_kind": rule.bonus_kind,
        "value": str(rule.value),
        "effective_from": rule.effective_from.isoformat(),
        "effective_to": rule.effective_to.isoformat() if rule.effective_to else None,
    }


# ---- Bônus / produção pessoal ---------------------------------------------

@bp.get("/me/bonus")
@login_required
def my_bonus():
    """Bônus do próprio vendedor (MP-004 — nunca vê o de outro)."""
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não tem bônus", status=403)
    year = int(request.args.get("year", today_local().year))
    month = int(request.args.get("month", today_local().month))
    product_id = request.args.get("product_id") or (
        next(iter(ctx.product_ids), None) if ctx.product_ids else None
    )
    if not product_id:
        return jsonify({"available": False, "reason": "Nenhum produto associado"})
    base = request.args.get("base", METRIC_NET_PREMIUM)
    result = services.compute_bonus_for_month(
        organization_id=ctx.organization_id,
        user_id=ctx.user_id,
        product_id=product_id,
        year=year,
        month=month,
        metric_base=base,
    )
    hint = services.next_bracket_hint(
        organization_id=ctx.organization_id,
        product_id=product_id,
        base=base,
        current=result.metric_value,
        on=services.month_bounds(year, month)[1],
    )
    can_see_amount = (
        ctx.role == ROLE_ADMIN
        or "sales.view_commission_amount" in ctx.grants
        or "bonus.view_own" in ctx.grants
    )
    return jsonify(
        {
            "available": True,
            "year": year,
            "month": month,
            "product_id": product_id,
            "base": result.metric_base,
            "current": str(result.metric_value),
            "amount": str(result.amount) if can_see_amount else None,
            "rule_id": result.applied_rule_id,
            "predicted_on": services.predicted_payment_date(year, month).isoformat(),
            "next_bracket": hint,
        }
    )


@bp.get("/me/production")
@login_required
def my_production():
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não tem produção comercial", status=403)
    year = int(request.args.get("year", today_local().year))
    month = int(request.args.get("month", today_local().month))
    product_id = request.args.get("product_id")
    summary = services.month_sales_summary(
        organization_id=ctx.organization_id,
        user_id=ctx.user_id,
        product_id=product_id,
        year=year,
        month=month,
    )
    goal = services.get_monthly_goal(
        organization_id=ctx.organization_id,
        user_id=ctx.user_id,
        product_id=product_id,
        year=year,
        month=month,
    )
    can_see_net = ctx.role == ROLE_ADMIN or "sales.view_net_premium" in ctx.grants
    can_see_comm = ctx.role == ROLE_ADMIN or "sales.view_commission_amount" in ctx.grants
    return jsonify(
        {
            "year": year,
            "month": month,
            "product_id": product_id,
            "count": summary["count"],
            "net_premium": str(summary["net_premium"]) if can_see_net else None,
            "commission_amount": str(summary["commission_amount"]) if can_see_comm else None,
            "goal": {
                "target_count": goal.target_count if goal else 0,
                "target_net_premium": str(goal.target_net_premium) if goal else "0",
            },
        }
    )


# ---- Admin: bônus por mês --------------------------------------------------

class PayBonusRequest(BaseModel):
    paid_amount: Decimal | None = None


class CancelBonusRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


@bp.get("/admin/bonus")
@login_required
def admin_bonus():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    year = int(request.args.get("year", today_local().year))
    month = int(request.args.get("month", today_local().month))
    rows = db.session.execute(
        select(BonusPayment).where(
            BonusPayment.organization_id == ctx.organization_id,
            BonusPayment.year == year,
            BonusPayment.month == month,
        )
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(b.id),
                    "user_id": str(b.user_id),
                    "product_id": str(b.product_id),
                    "year": b.year,
                    "month": b.month,
                    "state": b.state,
                    "metric_base": b.metric_base,
                    "metric_value": str(b.metric_value),
                    "amount": str(b.amount),
                    "predicted_on": b.predicted_on.isoformat(),
                    "paid_at": b.paid_at.isoformat() if b.paid_at else None,
                    "paid_amount": str(b.paid_amount) if b.paid_amount is not None else None,
                }
                for b in rows
            ]
        }
    )


@bp.post("/admin/bonus/refresh")
@login_required
def refresh_bonus():
    """Recalcula (ou cria) o snapshot previsto para cada par (vendedor, produto) do mês."""
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    year = int(request.args.get("year", today_local().year))
    month = int(request.args.get("month", today_local().month))
    base = request.args.get("base", METRIC_NET_PREMIUM)

    pairs = services.eligible_seller_product_pairs(
        organization_id=ctx.organization_id,
        year=year,
        month=month,
    )
    created = 0
    for user_id, product_id in pairs:
        services.get_or_create_prediction(
            organization_id=ctx.organization_id,
            user_id=user_id,
            product_id=product_id,
            year=year,
            month=month,
            metric_base=base,
        )
        created += 1
    db.session.commit()
    return jsonify({"refreshed": created})


@bp.post("/admin/bonus/<payment_id>/approve")
@login_required
def approve_bonus(payment_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    payment = db.session.get(BonusPayment, payment_id)
    if payment is None or payment.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Bônus não encontrado", status=404)
    services.approve_bonus(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        payment=payment,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(payment.id), "state": payment.state})


@bp.post("/admin/bonus/<payment_id>/pay")
@login_required
def pay_bonus(payment_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    payment = db.session.get(BonusPayment, payment_id)
    if payment is None or payment.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Bônus não encontrado", status=404)
    payload = PayBonusRequest.model_validate(request.get_json(silent=True) or {})
    services.mark_bonus_paid(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        payment=payment,
        paid_amount=payload.paid_amount,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "id": str(payment.id),
            "state": payment.state,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
            "paid_amount": (
                str(payment.paid_amount) if payment.paid_amount is not None else None
            ),
        }
    )


@bp.post("/admin/bonus/<payment_id>/cancel")
@login_required
def cancel_bonus(payment_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin", status=403)
    payment = db.session.get(BonusPayment, payment_id)
    if payment is None or payment.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Bônus não encontrado", status=404)
    payload = CancelBonusRequest.model_validate(request.get_json(silent=True) or {})
    services.cancel_bonus(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        payment=payment,
        reason=payload.reason.strip(),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(payment.id), "state": payment.state})
