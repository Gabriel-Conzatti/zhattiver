from __future__ import annotations

from flask import Blueprint, g, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.auth import verify_password
from ...core.authz import load_context
from ...core.errors import api_error
from ...core.time import now_utc
from ...extensions import db
from ..users.models import PermissionGrant, User
from .schemas import LoginRequest, UserPublic

bp = Blueprint("auth", __name__)


@bp.post("/login")
def login():
    payload = LoginRequest.model_validate(request.get_json(silent=True) or {})
    stmt = select(User).where(User.email == payload.email.lower())
    user = db.session.execute(stmt).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(user.password_hash, payload.password):
        # Não distinguir "usuário não existe" de "senha errada"
        return api_error("invalid_credentials", "Credenciais inválidas", status=401)

    login_user(user, remember=False, fresh=True)
    session.permanent = True
    user.last_login_at = now_utc()
    audit_record(
        organization_id=str(user.organization_id),
        actor_user_id=str(user.id),
        entity_type="user",
        entity_id=str(user.id),
        action="login",
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_user(user).model_dump()), 200


@bp.post("/logout")
def logout():
    if current_user.is_authenticated:
        audit_record(
            organization_id=str(current_user.organization_id),
            actor_user_id=str(current_user.id),
            entity_type="user",
            entity_id=str(current_user.id),
            action="logout",
            request_id=getattr(g, "request_id", None),
        )
        db.session.commit()
    logout_user()
    session.clear()
    return ("", 204)


@bp.get("/me")
@login_required
def me():
    return jsonify(_serialize_user(current_user).model_dump())


def _serialize_user(user: User) -> UserPublic:
    now = now_utc()
    grants = [g_.permission for g_ in PermissionGrant.active_for_user(user.id, now)]
    return UserPublic(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        organization_id=str(user.organization_id),
        products=[str(p.id) for p in user.products],
        grants=grants,
    )
