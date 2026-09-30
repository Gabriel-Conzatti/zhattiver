from __future__ import annotations

import re

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..users.models import ROLE_ADMIN, Product
from .models import ClientType, Insurer, Origin, Tag, TagCategory

bp = Blueprint("catalog", __name__)


def _slug(value: str) -> str:
    v = value.strip().lower()
    v = re.sub(r"[^\w]+", "-", v, flags=re.UNICODE)
    return v.strip("-")


class _NameOnly(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class _TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category_id: str | None = None
    color: str | None = None


def _serialize_named(obj) -> dict:
    return {"id": str(obj.id), "name": obj.name}


# --- listas públicas para todo perfil autenticado (apenas leitura) ------------

@bp.get("/products")
@login_required
def list_products():
    ctx = load_context()
    rows = db.session.execute(
        select(Product).where(
            Product.organization_id == ctx.organization_id,
            Product.archived_at.is_(None),
        ).order_by(Product.name)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {"id": str(p.id), "name": p.name, "slug": p.slug, "is_active": p.is_active}
                for p in rows
            ]
        }
    )


@bp.get("/origins")
@login_required
def list_origins():
    ctx = load_context()
    rows = db.session.execute(
        select(Origin).where(
            Origin.organization_id == ctx.organization_id,
            Origin.archived_at.is_(None),
        ).order_by(Origin.name)
    ).scalars().all()
    return jsonify({"items": [_serialize_named(o) for o in rows]})


@bp.get("/client-types")
@login_required
def list_client_types():
    ctx = load_context()
    rows = db.session.execute(
        select(ClientType).where(
            ClientType.organization_id == ctx.organization_id,
            ClientType.archived_at.is_(None),
        ).order_by(ClientType.name)
    ).scalars().all()
    return jsonify({"items": [_serialize_named(c) for c in rows]})


@bp.get("/insurers")
@login_required
def list_insurers():
    ctx = load_context()
    rows = db.session.execute(
        select(Insurer).where(
            Insurer.organization_id == ctx.organization_id,
            Insurer.archived_at.is_(None),
        ).order_by(Insurer.name)
    ).scalars().all()
    return jsonify({"items": [_serialize_named(i) for i in rows]})


@bp.get("/tags")
@login_required
def list_tags():
    ctx = load_context()
    rows = db.session.execute(
        select(Tag).where(
            Tag.organization_id == ctx.organization_id,
            Tag.archived_at.is_(None),
        ).order_by(Tag.name)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "color": t.color,
                    "category_id": str(t.category_id) if t.category_id else None,
                }
                for t in rows
            ]
        }
    )


@bp.get("/tag-categories")
@login_required
def list_tag_categories():
    ctx = load_context()
    rows = db.session.execute(
        select(TagCategory).where(
            TagCategory.organization_id == ctx.organization_id,
            TagCategory.archived_at.is_(None),
        ).order_by(TagCategory.name)
    ).scalars().all()
    return jsonify({"items": [_serialize_named(c) for c in rows]})


# --- criação: admin -----------------------------------------------------------

def _require_admin() -> None:
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)


@bp.post("/origins")
@login_required
def create_origin():
    _require_admin()
    ctx = load_context()
    data = _NameOnly.model_validate(request.get_json(silent=True) or {})
    obj = Origin(
        organization_id=ctx.organization_id,
        name=data.name.strip(),
        slug=_slug(data.name),
    )
    db.session.add(obj)
    _audit(ctx, "origin", None, "create", after={"name": obj.name})
    db.session.commit()
    return jsonify(_serialize_named(obj)), 201


@bp.post("/client-types")
@login_required
def create_client_type():
    _require_admin()
    ctx = load_context()
    data = _NameOnly.model_validate(request.get_json(silent=True) or {})
    obj = ClientType(
        organization_id=ctx.organization_id,
        name=data.name.strip(),
        slug=_slug(data.name),
    )
    db.session.add(obj)
    _audit(ctx, "client_type", None, "create", after={"name": obj.name})
    db.session.commit()
    return jsonify(_serialize_named(obj)), 201


@bp.post("/insurers")
@login_required
def create_insurer():
    _require_admin()
    ctx = load_context()
    data = _NameOnly.model_validate(request.get_json(silent=True) or {})
    obj = Insurer(organization_id=ctx.organization_id, name=data.name.strip())
    db.session.add(obj)
    _audit(ctx, "insurer", None, "create", after={"name": obj.name})
    db.session.commit()
    return jsonify(_serialize_named(obj)), 201


@bp.post("/tag-categories")
@login_required
def create_tag_category():
    _require_admin()
    ctx = load_context()
    data = _NameOnly.model_validate(request.get_json(silent=True) or {})
    obj = TagCategory(
        organization_id=ctx.organization_id,
        name=data.name.strip(),
        slug=_slug(data.name),
    )
    db.session.add(obj)
    _audit(ctx, "tag_category", None, "create", after={"name": obj.name})
    db.session.commit()
    return jsonify(_serialize_named(obj)), 201


@bp.post("/tags")
@login_required
def create_tag():
    _require_admin()
    ctx = load_context()
    data = _TagCreate.model_validate(request.get_json(silent=True) or {})
    obj = Tag(
        organization_id=ctx.organization_id,
        category_id=data.category_id,
        name=data.name.strip(),
        color=(data.color or "").strip() or None,
    )
    db.session.add(obj)
    _audit(ctx, "tag", None, "create", after={"name": obj.name})
    db.session.commit()
    return jsonify({"id": str(obj.id), "name": obj.name, "color": obj.color})


def _audit(ctx, entity_type, entity_id, action, *, after=None, before=None):
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
