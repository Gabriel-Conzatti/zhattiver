from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..leads.models import Lead
from ..users.models import ROLE_ADMIN
from . import services
from .models import CrossSellItem, CrossSellList

bp = Blueprint("cross_sell", __name__)


def _require_admin() -> None:
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)


class ListCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_product_id: str
    has_product_ids: list[str] = Field(default_factory=list)
    lacks_product_ids: list[str] = Field(default_factory=list)
    include_unknown: bool = False


class ReleaseRequest(BaseModel):
    item_ids: list[str] | None = None


@bp.get("/admin/cross-sell/lists")
@login_required
def list_lists():
    _require_admin()
    ctx = load_context()
    rows = db.session.execute(
        select(CrossSellList)
        .where(
            CrossSellList.organization_id == ctx.organization_id,
            CrossSellList.archived_at.is_(None),
        )
        .order_by(CrossSellList.created_at.desc())
        .limit(200)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(l.id),
                    "name": l.name,
                    "target_product_id": str(l.target_product_id),
                    "state": l.state,
                    "total_items": l.total_items,
                    "released_items": l.released_items,
                    "created_at": l.created_at.isoformat(),
                }
                for l in rows
            ]
        }
    )


@bp.post("/admin/cross-sell/lists")
@login_required
def create_list():
    _require_admin()
    ctx = load_context()
    payload = ListCreate.model_validate(request.get_json(silent=True) or {})
    csl = services.generate_list(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        name=payload.name,
        target_product_id=payload.target_product_id,
        has_product_ids=payload.has_product_ids,
        lacks_product_ids=payload.lacks_product_ids,
        include_unknown=payload.include_unknown,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(csl.id), "total_items": csl.total_items}), 201


@bp.get("/admin/cross-sell/lists/<list_id>")
@login_required
def get_list(list_id: str):
    _require_admin()
    ctx = load_context()
    csl = db.session.get(CrossSellList, list_id)
    if csl is None or csl.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Lista não encontrada", status=404)
    items = db.session.execute(
        select(CrossSellItem, Lead)
        .join(Lead, Lead.id == CrossSellItem.lead_id)
        .where(CrossSellItem.list_id == csl.id)
        .order_by(CrossSellItem.state, Lead.name)
        .limit(500)
    ).all()
    return jsonify(
        {
            "id": str(csl.id),
            "name": csl.name,
            "target_product_id": str(csl.target_product_id),
            "state": csl.state,
            "total_items": csl.total_items,
            "released_items": csl.released_items,
            "filters": csl.filters,
            "items": [
                {
                    "id": str(i.id),
                    "lead_id": str(l.id),
                    "lead_name": l.name,
                    "city": l.city,
                    "state": l.state,
                    "item_state": i.state,
                    "last_contact_at": i.last_contact_at.isoformat() if i.last_contact_at else None,
                    "released_at": i.released_at.isoformat() if i.released_at else None,
                }
                for i, l in items
            ],
        }
    )


@bp.post("/admin/cross-sell/lists/<list_id>/release")
@login_required
def release(list_id: str):
    _require_admin()
    ctx = load_context()
    csl = db.session.get(CrossSellList, list_id)
    if csl is None or csl.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Lista não encontrada", status=404)
    payload = ReleaseRequest.model_validate(request.get_json(silent=True) or {})
    released = services.release_items(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        csl=csl,
        item_ids=payload.item_ids,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"released": released, "state": csl.state})
