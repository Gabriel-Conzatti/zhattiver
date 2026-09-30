from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..bonus import services as bonus_services
from ..leads.models import Lead
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR
from . import services
from .models import (
    STATE_CANCELLED,
    STATE_REGISTERED,
    STATE_REVISION_PENDING,
    STATE_VALIDATED,
    Sale,
    SaleRevision,
)

bp = Blueprint("sales", __name__)


# --- Visibilidade financeira -------------------------------------------------

def _visibility(ctx) -> dict[str, bool]:
    is_admin = ctx.role == ROLE_ADMIN
    return {
        "net_premium": is_admin or "sales.view_net_premium" in ctx.grants,
        "commission_pct": is_admin or "sales.view_commission_pct" in ctx.grants,
        "commission_amount": is_admin or "sales.view_commission_amount" in ctx.grants,
        "state": is_admin,
    }


def _serialize(sale: Sale, ctx, *, include_finance_for_own: bool = False) -> dict:
    vis = _visibility(ctx)
    is_owner = ctx.user_id == str(sale.seller_user_id)
    show_net = vis["net_premium"] or (is_owner and include_finance_for_own)
    show_pct = vis["commission_pct"] or (is_owner and include_finance_for_own)
    show_comm = vis["commission_amount"]  # comissão calculada é administrativa (RN-033)
    payload = {
        "id": str(sale.id),
        "lead_id": str(sale.lead_id),
        "opportunity_id": str(sale.opportunity_id) if sale.opportunity_id else None,
        "product_id": str(sale.product_id),
        "seller_user_id": str(sale.seller_user_id),
        "insurer_id": str(sale.insurer_id),
        "client_type_id": str(sale.client_type_id),
        "closed_on": sale.closed_on.isoformat(),
        "origin": sale.origin,
        "registered_at": sale.registered_at.isoformat(),
        "edit_deadline_at": sale.edit_deadline_at.isoformat(),
        "state": sale.state if vis["state"] else _public_state(sale.state),
        "cancelled_reason": sale.cancelled_reason if vis["state"] else None,
        "cancelled_kind": sale.cancelled_kind if vis["state"] else None,
    }
    if show_net:
        payload["net_premium"] = str(sale.net_premium)
    if show_pct:
        payload["commission_pct"] = str(sale.commission_pct)
    if show_comm:
        payload["commission_amount"] = str(sale.commission_amount)
    return payload


def _public_state(state: str) -> str:
    # Vendedor não precisa ver o estado interno (RN-036); expomos como "registered" até o cancel.
    if state == STATE_CANCELLED:
        return STATE_CANCELLED
    return STATE_REGISTERED


# --- Schemas ---------------------------------------------------------------

class SaleCreate(BaseModel):
    lead_id: str
    product_id: str
    insurer_id: str
    client_type_id: str
    net_premium: Decimal = Field(gt=0)
    commission_pct: Decimal = Field(gt=0, le=1)
    closed_on: date
    opportunity_id: str | None = None
    origin: str | None = None
    notes: str | None = None
    seller_user_id: str | None = None  # admin pode registrar em nome de outro


class SaleUpdate(BaseModel):
    insurer_id: str | None = None
    client_type_id: str | None = None
    net_premium: Decimal | None = Field(default=None, gt=0)
    commission_pct: Decimal | None = Field(default=None, gt=0, le=1)
    closed_on: date | None = None
    notes: str | None = None


class SaleCancel(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


# --- Rotas ------------------------------------------------------------------

@bp.post("/sales")
@login_required
def create_sale():
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não registra vendas", status=403)
    payload = SaleCreate.model_validate(request.get_json(silent=True) or {})
    if ctx.role == ROLE_VENDEDOR and payload.product_id not in ctx.product_ids:
        raise BusinessError("forbidden", "Produto fora do seu escopo", status=403)

    seller = payload.seller_user_id or ctx.user_id
    if ctx.role != ROLE_ADMIN and seller != ctx.user_id:
        raise BusinessError("forbidden", "Sem permissão para registrar em nome de outro", status=403)

    sale = services.create_sale(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        data=services.SaleInput(
            lead_id=payload.lead_id,
            product_id=payload.product_id,
            seller_user_id=seller,
            insurer_id=payload.insurer_id,
            client_type_id=payload.client_type_id,
            net_premium=payload.net_premium,
            commission_pct=payload.commission_pct,
            closed_on=payload.closed_on,
            opportunity_id=payload.opportunity_id,
            origin=payload.origin,
            notes=payload.notes,
        ),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize(sale, ctx, include_finance_for_own=True)), 201


@bp.get("/sales")
@login_required
def list_sales():
    ctx = load_context()
    scope = request.args.get("scope", "mine")
    state = request.args.get("state")
    stmt = select(Sale).where(Sale.organization_id == ctx.organization_id)
    if ctx.role == ROLE_VENDEDOR or scope == "mine":
        stmt = stmt.where(Sale.seller_user_id == ctx.user_id)
    if state:
        stmt = stmt.where(Sale.state == state)
    stmt = stmt.order_by(Sale.registered_at.desc()).limit(200)
    sales = db.session.execute(stmt).scalars().all()
    return jsonify(
        {"items": [_serialize(s, ctx, include_finance_for_own=True) for s in sales]}
    )


@bp.get("/sales/<sale_id>")
@login_required
def get_sale(sale_id: str):
    ctx = load_context()
    sale = _load(sale_id, ctx)
    lead = db.session.get(Lead, sale.lead_id)
    return jsonify(
        {
            **_serialize(sale, ctx, include_finance_for_own=True),
            "lead_name": lead.name if lead else None,
        }
    )


@bp.patch("/sales/<sale_id>")
@login_required
def update_sale(sale_id: str):
    ctx = load_context()
    sale = _load(sale_id, ctx)
    payload = SaleUpdate.model_validate(request.get_json(silent=True) or {})
    changes = payload.model_dump(exclude_none=True)
    result = services.edit_sale(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        actor_role=ctx.role,
        actor_grants=frozenset(ctx.grants),
        sale=sale,
        changes=changes,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    if isinstance(result, SaleRevision):
        return jsonify(
            {
                "revision": {
                    "id": str(result.id),
                    "state": result.state,
                    "submitted_at": result.submitted_at.isoformat(),
                    "payload": result.payload,
                },
                "sale_state": sale.state,
            }
        ), 202
    return jsonify(_serialize(sale, ctx, include_finance_for_own=True))


@bp.post("/sales/<sale_id>/validate")
@login_required
def validate_sale(sale_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN and "sales.validate" not in ctx.grants:
        raise BusinessError("forbidden", "Sem permissão para validar", status=403)
    sale = _load(sale_id, ctx)
    services.validate_sale(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        sale=sale,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize(sale, ctx))


@bp.post("/sales/<sale_id>/cancel")
@login_required
def cancel_sale(sale_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin cancela", status=403)
    sale = _load(sale_id, ctx)
    payload = SaleCancel.model_validate(request.get_json(silent=True) or {})
    already_paid = bonus_services.bonus_paid_for_sale_month(
        organization_id=ctx.organization_id,
        user_id=sale.seller_user_id,
        product_id=sale.product_id,
        year=sale.closed_on.year,
        month=sale.closed_on.month,
    )
    services.cancel_sale(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        sale=sale,
        reason=payload.reason,
        bonus_already_paid=already_paid,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize(sale, ctx))


def _load(sale_id: str, ctx) -> Sale:
    sale = db.session.get(Sale, sale_id)
    if sale is None or sale.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Venda não encontrada", status=404)
    if ctx.role == ROLE_VENDEDOR and str(sale.seller_user_id) != ctx.user_id:
        raise BusinessError("forbidden", "Venda fora do seu escopo", status=403)
    return sale
