from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..users.models import ROLE_ADMIN, Product
from .models import Funnel, FunnelStage

bp = Blueprint("funnel_admin", __name__)


class FunnelCreate(BaseModel):
    product_id: str
    name: str = Field(min_length=1, max_length=120)
    is_default: bool = False


class FunnelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_default: bool | None = None
    archived: bool | None = None


class StageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    order_index: int = Field(ge=0)
    is_initial: bool = False
    is_final: bool = False
    message_template: str | None = Field(default=None, max_length=4000)


class StageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    order_index: int | None = Field(default=None, ge=0)
    is_initial: bool | None = None
    is_final: bool | None = None
    message_template: str | None = Field(default=None, max_length=4000)
    archived: bool | None = None


def _admin_context():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)
    return ctx


def _owned_funnel(funnel_id: str, organization_id: str) -> Funnel:
    funnel = db.session.get(Funnel, funnel_id)
    if funnel is None or funnel.organization_id != organization_id:
        raise BusinessError("not_found", "Funil não encontrado", status=404)
    return funnel


def _owned_stage(stage_id: str, organization_id: str) -> FunnelStage:
    stage = db.session.get(FunnelStage, stage_id)
    if stage is None or stage.organization_id != organization_id:
        raise BusinessError("not_found", "Etapa não encontrada", status=404)
    return stage


def _clean_name(value: str) -> str:
    name = value.strip()
    if not name:
        raise BusinessError("invalid_name", "Nome inválido", status=422)
    return name


def _set_default(funnel: Funnel) -> None:
    rows = db.session.execute(
        select(Funnel).where(
            Funnel.organization_id == funnel.organization_id,
            Funnel.product_id == funnel.product_id,
            Funnel.id != funnel.id,
            Funnel.archived_at.is_(None),
        )
    ).scalars()
    for other in rows:
        other.is_default = False


def _set_initial(stage: FunnelStage) -> None:
    rows = db.session.execute(
        select(FunnelStage).where(
            FunnelStage.organization_id == stage.organization_id,
            FunnelStage.funnel_id == stage.funnel_id,
            FunnelStage.id != stage.id,
            FunnelStage.archived_at.is_(None),
        )
    ).scalars()
    for other in rows:
        other.is_initial = False


def _audit(ctx, entity_type: str, entity_id: str, action: str, before: dict, after: dict):
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before=before,
        after=after,
        request_id=getattr(g, "request_id", None),
    )


def _serialize_stage(stage: FunnelStage) -> dict:
    return {
        "id": str(stage.id),
        "name": stage.name,
        "order_index": stage.order_index,
        "is_initial": stage.is_initial,
        "is_final": stage.is_final,
        "message_template": stage.message_template,
        "archived": stage.archived_at is not None,
    }


@bp.get("/admin/funnels")
@login_required
def list_funnels():
    ctx = _admin_context()
    include_archived = request.args.get("include_archived") == "true"
    funnel_stmt = select(Funnel).where(Funnel.organization_id == ctx.organization_id)
    stage_stmt = select(FunnelStage).where(FunnelStage.organization_id == ctx.organization_id)
    if not include_archived:
        funnel_stmt = funnel_stmt.where(Funnel.archived_at.is_(None))
        stage_stmt = stage_stmt.where(FunnelStage.archived_at.is_(None))
    funnels = db.session.execute(
        funnel_stmt.order_by(Funnel.product_id, Funnel.name)
    ).scalars().all()
    stages = db.session.execute(
        stage_stmt.order_by(FunnelStage.funnel_id, FunnelStage.order_index, FunnelStage.name)
    ).scalars().all()
    stages_by_funnel: dict[str, list[dict]] = {}
    for stage in stages:
        stages_by_funnel.setdefault(str(stage.funnel_id), []).append(_serialize_stage(stage))
    return jsonify(
        {
            "items": [
                {
                    "id": str(funnel.id),
                    "product_id": str(funnel.product_id),
                    "name": funnel.name,
                    "is_default": funnel.is_default,
                    "archived": funnel.archived_at is not None,
                    "stages": stages_by_funnel.get(str(funnel.id), []),
                }
                for funnel in funnels
            ]
        }
    )


@bp.post("/admin/funnels")
@login_required
def create_funnel():
    ctx = _admin_context()
    payload = FunnelCreate.model_validate(request.get_json(silent=True) or {})
    product = db.session.get(Product, payload.product_id)
    if (
        product is None
        or product.organization_id != ctx.organization_id
        or not product.is_active
        or product.archived_at is not None
    ):
        raise BusinessError("invalid_product", "Produto inválido", status=422)
    funnel = Funnel(
        organization_id=ctx.organization_id,
        product_id=product.id,
        name=_clean_name(payload.name),
        is_default=payload.is_default,
    )
    db.session.add(funnel)
    db.session.flush()
    if funnel.is_default:
        _set_default(funnel)
    after = {"name": funnel.name, "product_id": str(product.id), "is_default": funnel.is_default}
    _audit(ctx, "funnel", str(funnel.id), "create", {}, after)
    db.session.commit()
    return jsonify({"id": str(funnel.id)}), 201


@bp.patch("/admin/funnels/<funnel_id>")
@login_required
def update_funnel(funnel_id: str):
    ctx = _admin_context()
    funnel = _owned_funnel(funnel_id, ctx.organization_id)
    payload = FunnelUpdate.model_validate(request.get_json(silent=True) or {})
    before = {
        "name": funnel.name,
        "is_default": funnel.is_default,
        "archived": funnel.archived_at is not None,
    }
    if payload.name is not None:
        funnel.name = _clean_name(payload.name)
    if payload.is_default is not None:
        funnel.is_default = payload.is_default
        if funnel.is_default:
            _set_default(funnel)
    if payload.archived is not None:
        funnel.archived_at = now_utc() if payload.archived else None
        if payload.archived:
            funnel.is_default = False
    after = {
        "name": funnel.name,
        "is_default": funnel.is_default,
        "archived": funnel.archived_at is not None,
    }
    _audit(ctx, "funnel", str(funnel.id), "update", before, after)
    db.session.commit()
    return jsonify(after)


@bp.post("/admin/funnels/<funnel_id>/stages")
@login_required
def create_stage(funnel_id: str):
    ctx = _admin_context()
    funnel = _owned_funnel(funnel_id, ctx.organization_id)
    if funnel.archived_at is not None:
        raise BusinessError("funnel_archived", "Funil arquivado", status=422)
    payload = StageCreate.model_validate(request.get_json(silent=True) or {})
    stage = FunnelStage(
        organization_id=ctx.organization_id,
        funnel_id=funnel.id,
        name=_clean_name(payload.name),
        order_index=payload.order_index,
        is_initial=payload.is_initial,
        is_final=payload.is_final,
        message_template=(payload.message_template or "").strip() or None,
    )
    db.session.add(stage)
    db.session.flush()
    if stage.is_initial:
        _set_initial(stage)
    after = _serialize_stage(stage)
    _audit(ctx, "funnel_stage", str(stage.id), "create", {}, after)
    db.session.commit()
    return jsonify(after), 201


@bp.patch("/admin/funnel-stages/<stage_id>")
@login_required
def update_stage(stage_id: str):
    ctx = _admin_context()
    stage = _owned_stage(stage_id, ctx.organization_id)
    payload = StageUpdate.model_validate(request.get_json(silent=True) or {})
    before = _serialize_stage(stage)
    if payload.name is not None:
        stage.name = _clean_name(payload.name)
    if payload.order_index is not None:
        stage.order_index = payload.order_index
    if payload.is_initial is not None:
        stage.is_initial = payload.is_initial
        if stage.is_initial:
            _set_initial(stage)
    if payload.is_final is not None:
        stage.is_final = payload.is_final
    if "message_template" in payload.model_fields_set:
        stage.message_template = (payload.message_template or "").strip() or None
    if payload.archived is not None:
        stage.archived_at = now_utc() if payload.archived else None
        if payload.archived:
            stage.is_initial = False
    after = _serialize_stage(stage)
    _audit(ctx, "funnel_stage", str(stage.id), "update", before, after)
    db.session.commit()
    return jsonify(after)
