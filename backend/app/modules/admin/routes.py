from __future__ import annotations

from datetime import date, datetime, timedelta

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select

from ...core.audit import record as audit_record
from ...core.auth import hash_password
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc, today_local
from ...extensions import db
from ..goals.models import DailyProspectingQuota
from ..leads.models import Lead
from ..opportunities.models import STATE_OPEN, Opportunity
from ..sales.models import STATE_REGISTERED as SALE_STATE_REGISTERED
from ..sales.models import Sale
from ..schedules.models import STATE_SCHEDULED, Schedule
from ..users.models import (
    ROLE_ADMIN,
    ROLE_VENDEDOR,
    ROLES,
    PermissionGrant,
    Product,
    User,
)

bp = Blueprint("admin", __name__)


def _require_admin() -> None:
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)


# ---------------- Usuários --------------------------------------------------

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    role: str
    password: str = Field(min_length=10, max_length=200)
    product_ids: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = None
    is_active: bool | None = None
    product_ids: list[str] | None = None
    reset_password: str | None = Field(default=None, min_length=10, max_length=200)
    daily_prospecting_quota: int | None = Field(default=None, ge=0, le=10_000)
    quota_effective_from: date | None = None


def _serialize_user(u: User) -> dict:
    quota = _prospecting_quota_at(u.id, today_local())
    return {
        "id": str(u.id),
        "email": u.email,
        "name": u.name,
        "role": u.role,
        "is_active": u.is_active,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "product_ids": [str(p.id) for p in u.products],
        "daily_prospecting_quota": quota.quota if quota else None,
        "quota_effective_from": quota.effective_from.isoformat() if quota else None,
    }


def _prospecting_quota_at(user_id: str, on: date) -> DailyProspectingQuota | None:
    return db.session.execute(
        select(DailyProspectingQuota)
        .where(
            DailyProspectingQuota.user_id == user_id,
            DailyProspectingQuota.effective_from <= on,
            or_(
                DailyProspectingQuota.effective_to.is_(None),
                DailyProspectingQuota.effective_to >= on,
            ),
        )
        .order_by(DailyProspectingQuota.effective_from.desc())
    ).scalars().first()


def _set_prospecting_quota(
    *,
    organization_id: str,
    user_id: str,
    quota: int,
    effective_from: date,
) -> None:
    same_start = db.session.execute(
        select(DailyProspectingQuota).where(
            DailyProspectingQuota.user_id == user_id,
            DailyProspectingQuota.effective_from == effective_from,
        )
    ).scalar_one_or_none()
    if same_start is not None:
        same_start.quota = quota
        return

    current = _prospecting_quota_at(user_id, effective_from)
    if current is not None:
        current.effective_to = effective_from - timedelta(days=1)

    next_quota = db.session.execute(
        select(DailyProspectingQuota)
        .where(
            DailyProspectingQuota.user_id == user_id,
            DailyProspectingQuota.effective_from > effective_from,
        )
        .order_by(DailyProspectingQuota.effective_from)
    ).scalars().first()
    db.session.add(
        DailyProspectingQuota(
            organization_id=organization_id,
            user_id=user_id,
            quota=quota,
            effective_from=effective_from,
            effective_to=(
                next_quota.effective_from - timedelta(days=1) if next_quota else None
            ),
        )
    )


@bp.get("/admin/users")
@login_required
def list_users():
    _require_admin()
    ctx = load_context()
    rows = db.session.execute(
        select(User)
        .where(User.organization_id == ctx.organization_id)
        .order_by(User.name)
    ).scalars().all()
    return jsonify({"items": [_serialize_user(u) for u in rows]})


@bp.post("/admin/users")
@login_required
def create_user():
    _require_admin()
    ctx = load_context()
    payload = UserCreate.model_validate(request.get_json(silent=True) or {})
    if payload.role not in ROLES:
        raise BusinessError("invalid_role", "Perfil inválido", status=422)
    if db.session.execute(
        select(User).where(User.email == payload.email.lower())
    ).scalar_one_or_none():
        raise BusinessError("duplicate_email", "Já existe usuário com esse email", status=409)

    user = User(
        organization_id=ctx.organization_id,
        email=payload.email.lower(),
        name=payload.name.strip(),
        role=payload.role,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.session.add(user)
    db.session.flush()

    if payload.product_ids:
        products = db.session.execute(
            select(Product).where(
                Product.organization_id == ctx.organization_id,
                Product.id.in_(payload.product_ids),
            )
        ).scalars().all()
        user.products = list(products)

    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="user",
        entity_id=str(user.id),
        action="create",
        after={"email": user.email, "role": user.role, "products": payload.product_ids},
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_user(user)), 201


@bp.patch("/admin/users/<user_id>")
@login_required
def update_user(user_id: str):
    _require_admin()
    ctx = load_context()
    user = db.session.get(User, user_id)
    if user is None or user.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Usuário não encontrado", status=404)
    payload = UserUpdate.model_validate(request.get_json(silent=True) or {})
    previous_quota = _prospecting_quota_at(user.id, today_local())
    before = {
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "products": [str(p.id) for p in user.products],
        "daily_prospecting_quota": previous_quota.quota if previous_quota else None,
        "quota_effective_from": (
            previous_quota.effective_from.isoformat() if previous_quota else None
        ),
    }
    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.role is not None:
        if payload.role not in ROLES:
            raise BusinessError("invalid_role", "Perfil inválido", status=422)
        if user.id == ctx.user_id and payload.role != ROLE_ADMIN:
            raise BusinessError("forbidden", "Não é possível rebaixar o próprio admin", status=403)
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == ctx.user_id and not payload.is_active:
            raise BusinessError("forbidden", "Não é possível desativar o próprio admin", status=403)
        user.is_active = payload.is_active
    if payload.product_ids is not None:
        products = db.session.execute(
            select(Product).where(
                Product.organization_id == ctx.organization_id,
                Product.id.in_(payload.product_ids),
            )
        ).scalars().all()
        user.products = list(products)
    if payload.reset_password:
        user.password_hash = hash_password(payload.reset_password)
        user.session_version += 1
    if payload.daily_prospecting_quota is not None:
        if user.role != ROLE_VENDEDOR:
            raise BusinessError(
                "invalid_role",
                "Meta diária de prospecção é exclusiva de vendedor",
                status=422,
            )
        effective_from = payload.quota_effective_from or today_local()
        if effective_from < today_local():
            raise BusinessError(
                "invalid_effective_from",
                "A vigência da meta não pode começar no passado",
                status=422,
            )
        _set_prospecting_quota(
            organization_id=ctx.organization_id,
            user_id=user.id,
            quota=payload.daily_prospecting_quota,
            effective_from=effective_from,
        )
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="user",
        entity_id=str(user.id),
        action="update",
        before=before,
        after={
            "name": user.name,
            "role": user.role,
            "is_active": user.is_active,
            "products": [str(p.id) for p in user.products],
            "password_reset": bool(payload.reset_password),
            "daily_prospecting_quota": (
                payload.daily_prospecting_quota
                if payload.daily_prospecting_quota is not None
                else (previous_quota.quota if previous_quota else None)
            ),
            "quota_effective_from": (
                (payload.quota_effective_from or today_local()).isoformat()
                if payload.daily_prospecting_quota is not None
                else (
                    previous_quota.effective_from.isoformat()
                    if previous_quota
                    else None
                )
            ),
        },
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_user(user))


# ---------------- Concessões (MP-005/006) -----------------------------------

class GrantCreate(BaseModel):
    user_id: str
    permission: str = Field(min_length=1, max_length=80)
    target_user_id: str | None = None
    scope: dict | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    reason: str | None = None


@bp.get("/admin/grants")
@login_required
def list_grants():
    _require_admin()
    ctx = load_context()
    stmt = select(PermissionGrant).where(
        PermissionGrant.organization_id == ctx.organization_id,
    ).order_by(PermissionGrant.created_at.desc()).limit(200)
    rows = db.session.execute(stmt).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(g.id),
                    "user_id": str(g.user_id),
                    "target_user_id": str(g.target_user_id) if g.target_user_id else None,
                    "permission": g.permission,
                    "scope": g.scope,
                    "starts_at": g.starts_at.isoformat() if g.starts_at else None,
                    "ends_at": g.ends_at.isoformat() if g.ends_at else None,
                    "reason": g.reason,
                    "revoked_at": g.revoked_at.isoformat() if g.revoked_at else None,
                    "granted_by": str(g.granted_by),
                }
                for g in rows
            ]
        }
    )


@bp.post("/admin/grants")
@login_required
def create_grant():
    _require_admin()
    ctx = load_context()
    payload = GrantCreate.model_validate(request.get_json(silent=True) or {})
    user = db.session.get(User, payload.user_id)
    if user is None or user.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Usuário não encontrado", status=404)
    if payload.target_user_id:
        target_user = db.session.get(User, payload.target_user_id)
        if target_user is None or target_user.organization_id != ctx.organization_id:
            raise BusinessError("not_found", "Usuário substituído não encontrado", status=404)
    if payload.permission.startswith("bonus.view_others"):
        raise BusinessError(
            "forbidden",
            "Bônus de outros vendedores nunca pode ser delegado (MP-004)",
            status=403,
        )
    grant = PermissionGrant(
        organization_id=ctx.organization_id,
        user_id=payload.user_id,
        granted_by=ctx.user_id,
        target_user_id=payload.target_user_id,
        permission=payload.permission,
        scope=payload.scope or {},
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        reason=payload.reason,
    )
    db.session.add(grant)
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="permission_grant",
        entity_id=None,
        action="create",
        after={
            "user_id": payload.user_id,
            "permission": payload.permission,
            "ends_at": payload.ends_at.isoformat() if payload.ends_at else None,
            "reason": payload.reason,
        },
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(grant.id)}), 201


@bp.post("/admin/grants/<grant_id>/revoke")
@login_required
def revoke_grant(grant_id: str):
    _require_admin()
    ctx = load_context()
    grant = db.session.get(PermissionGrant, grant_id)
    if grant is None or grant.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Concessão não encontrada", status=404)
    if grant.revoked_at is not None:
        return ("", 204)
    grant.revoked_at = now_utc()
    audit_record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="permission_grant",
        entity_id=str(grant.id),
        action="revoke",
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return ("", 204)


# ---------------- Dashboard consolidado -------------------------------------

@bp.get("/admin/dashboard")
@login_required
def dashboard():
    _require_admin()
    ctx = load_context()
    org = ctx.organization_id

    def _count(stmt):
        return int(db.session.execute(stmt).scalar_one() or 0)

    leads_total = _count(
        select(func.count(Lead.id)).where(
            Lead.organization_id == org, Lead.archived_at.is_(None)
        )
    )
    open_opps = _count(
        select(func.count(Opportunity.id)).where(
            Opportunity.organization_id == org, Opportunity.state == STATE_OPEN
        )
    )
    pending_sales = _count(
        select(func.count(Sale.id)).where(
            Sale.organization_id == org, Sale.state == SALE_STATE_REGISTERED
        )
    )
    active_schedules = _count(
        select(func.count(Schedule.id)).where(
            Schedule.organization_id == org,
            Schedule.state == STATE_SCHEDULED,
            Schedule.archived_at.is_(None),
        )
    )
    users_active = _count(
        select(func.count(User.id)).where(
            User.organization_id == org, User.is_active.is_(True)
        )
    )
    return jsonify(
        {
            "leads_total": leads_total,
            "open_opportunities": open_opps,
            "pending_sales": pending_sales,
            "active_schedules": active_schedules,
            "active_users": users_active,
        }
    )
