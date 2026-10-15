from __future__ import annotations

import re

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR, Product
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


class _AdminCatalogWrite(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category_id: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class _AdminCatalogUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    category_id: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    archived: bool | None = None


def _serialize_named(obj) -> dict:
    return {"id": str(obj.id), "name": obj.name}


# --- listas públicas para todo perfil autenticado (apenas leitura) ------------

@bp.get("/products")
@login_required
def list_products():
    ctx = load_context()
    stmt = select(Product).where(
        Product.organization_id == ctx.organization_id,
        Product.archived_at.is_(None),
    )
    if ctx.role in (ROLE_SDR, ROLE_VENDEDOR):
        stmt = stmt.where(Product.id.in_(ctx.product_ids))
    rows = db.session.execute(stmt.order_by(Product.name)).scalars().all()
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
    if data.category_id:
        category = db.session.get(TagCategory, data.category_id)
        if category is None or category.organization_id != ctx.organization_id:
            raise BusinessError("not_found", "Categoria não encontrada", status=404)
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


# --- manutenção administrativa consolidada ----------------------------------

_CATALOG_MODELS = {
    "products": Product,
    "origins": Origin,
    "client-types": ClientType,
    "insurers": Insurer,
    "tag-categories": TagCategory,
    "tags": Tag,
}
_CATALOG_AUDIT_TYPES = {
    "products": "product",
    "origins": "origin",
    "client-types": "client_type",
    "insurers": "insurer",
    "tag-categories": "tag_category",
    "tags": "tag",
}


@bp.get("/admin/catalogs")
@login_required
def admin_catalogs():
    _require_admin()
    ctx = load_context()
    return jsonify(
        {
            kind.replace("-", "_"): [
                _serialize_admin_catalog(item, kind)
                for item in db.session.execute(
                    select(model)
                    .where(model.organization_id == ctx.organization_id)
                    .order_by(model.name)
                ).scalars()
            ]
            for kind, model in _CATALOG_MODELS.items()
        }
    )


@bp.post("/admin/catalogs/<kind>")
@login_required
def admin_create_catalog(kind: str):
    _require_admin()
    ctx = load_context()
    model = _catalog_model(kind)
    data = _AdminCatalogWrite.model_validate(request.get_json(silent=True) or {})
    name = data.name.strip()
    _ensure_unique_catalog_name(
        model=model,
        kind=kind,
        organization_id=ctx.organization_id,
        name=name,
    )
    values = _catalog_values(
        kind=kind,
        organization_id=ctx.organization_id,
        name=name,
        category_id=data.category_id,
        color=data.color,
    )
    obj = model(**values)
    db.session.add(obj)
    db.session.flush()
    _audit(
        ctx,
        _CATALOG_AUDIT_TYPES[kind],
        str(obj.id),
        "create",
        after=_serialize_admin_catalog(obj, kind),
    )
    db.session.commit()
    return jsonify(_serialize_admin_catalog(obj, kind)), 201


@bp.patch("/admin/catalogs/<kind>/<item_id>")
@login_required
def admin_update_catalog(kind: str, item_id: str):
    _require_admin()
    ctx = load_context()
    model = _catalog_model(kind)
    obj = db.session.get(model, item_id)
    if obj is None or obj.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Configuração não encontrada", status=404)
    data = _AdminCatalogUpdate.model_validate(request.get_json(silent=True) or {})
    before = _serialize_admin_catalog(obj, kind)
    fields = data.model_fields_set
    if "name" in fields and data.name is not None:
        name = data.name.strip()
        _ensure_unique_catalog_name(
            model=model,
            kind=kind,
            organization_id=ctx.organization_id,
            name=name,
            exclude_id=str(obj.id),
        )
        obj.name = name
        if hasattr(obj, "slug"):
            obj.slug = _slug(name)
    if kind == "tags":
        if "category_id" in fields:
            _validate_tag_category(ctx.organization_id, data.category_id)
            obj.category_id = data.category_id
        if "color" in fields:
            obj.color = data.color
    if "archived" in fields and data.archived is not None:
        obj.archived_at = now_utc() if data.archived else None
    after = _serialize_admin_catalog(obj, kind)
    _audit(
        ctx,
        _CATALOG_AUDIT_TYPES[kind],
        str(obj.id),
        "update",
        before=before,
        after=after,
    )
    db.session.commit()
    return jsonify(after)


def _catalog_model(kind: str):
    model = _CATALOG_MODELS.get(kind)
    if model is None:
        raise BusinessError("not_found", "Catálogo não encontrado", status=404)
    return model


def _catalog_values(
    *,
    kind: str,
    organization_id: str,
    name: str,
    category_id: str | None,
    color: str | None,
) -> dict:
    values = {"organization_id": organization_id, "name": name}
    if kind in {"products", "origins", "client-types", "tag-categories"}:
        values["slug"] = _slug(name)
    if kind == "tags":
        _validate_tag_category(organization_id, category_id)
        values.update({"category_id": category_id, "color": color})
    return values


def _validate_tag_category(organization_id: str, category_id: str | None) -> None:
    if category_id is None:
        return
    category = db.session.get(TagCategory, category_id)
    if (
        category is None
        or category.organization_id != organization_id
        or category.archived_at is not None
    ):
        raise BusinessError("not_found", "Categoria não encontrada", status=404)


def _ensure_unique_catalog_name(
    *,
    model,
    kind: str,
    organization_id: str,
    name: str,
    exclude_id: str | None = None,
) -> None:
    comparison = model.slug == _slug(name) if hasattr(model, "slug") else model.name == name
    stmt = select(model.id).where(
        model.organization_id == organization_id,
        comparison,
    )
    if exclude_id:
        stmt = stmt.where(model.id != exclude_id)
    if db.session.execute(stmt).first() is not None:
        raise BusinessError("duplicate", "Já existe uma configuração com esse nome", status=409)


def _serialize_admin_catalog(obj, kind: str) -> dict:
    payload = {
        "id": str(obj.id),
        "name": obj.name,
        "archived": obj.archived_at is not None,
    }
    if hasattr(obj, "slug"):
        payload["slug"] = obj.slug
    if hasattr(obj, "is_active"):
        payload["is_active"] = obj.is_active
    if kind == "tags":
        payload["category_id"] = str(obj.category_id) if obj.category_id else None
        payload["color"] = obj.color
    return payload


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
