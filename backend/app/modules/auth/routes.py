from __future__ import annotations

from flask import Blueprint, current_app, g, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.auth import hash_password, verify_password
from ...core.errors import api_error
from ...core.login_rate_limit import LoginRateLimiter
from ...core.time import now_utc
from ...extensions import db
from ..users.models import PermissionGrant, User
from .schemas import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, UserPublic

bp = Blueprint("auth", __name__)


@bp.post("/login")
def login():
    payload = LoginRequest.model_validate(request.get_json(silent=True) or {})
    limiter = LoginRateLimiter(current_app)
    remote_addr = request.remote_addr or "unknown"
    status = limiter.check(email=payload.email, remote_addr=remote_addr)
    if status.blocked:
        return _rate_limited(status.retry_after)

    stmt = select(User).where(User.email == payload.email.lower())
    user = db.session.execute(stmt).scalar_one_or_none()
    if (
        user is None
        or not user.is_active
        or not verify_password(user.password_hash, payload.password)
    ):
        # Não distinguir "usuário não existe" de "senha errada"
        status = limiter.register_failure(email=payload.email, remote_addr=remote_addr)
        if status.blocked:
            return _rate_limited(status.retry_after)
        return api_error("invalid_credentials", "Credenciais inválidas", status=401)

    limiter.clear_account_failures(email=payload.email)
    login_user(user, remember=False, fresh=True)
    session.permanent = True
    session["auth_version"] = user.session_version
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


def _rate_limited(retry_after: int):
    response = api_error(
        "too_many_login_attempts",
        "Muitas tentativas de acesso. Aguarde antes de tentar novamente.",
        status=429,
    )
    response.headers["Retry-After"] = str(retry_after)
    return response


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


@bp.patch("/profile")
@login_required
def update_profile():
    payload = ProfileUpdateRequest.model_validate(request.get_json(silent=True) or {})
    name = payload.name.strip()
    if not name:
        return api_error("invalid_name", "Nome inválido", status=422)
    before = {"name": current_user.name}
    current_user.name = name
    audit_record(
        organization_id=str(current_user.organization_id),
        actor_user_id=str(current_user.id),
        entity_type="user",
        entity_id=str(current_user.id),
        action="profile_update",
        before=before,
        after={"name": name},
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_user(current_user).model_dump())


@bp.post("/change-password")
@login_required
def change_password():
    payload = PasswordChangeRequest.model_validate(request.get_json(silent=True) or {})
    if not verify_password(current_user.password_hash, payload.current_password):
        return api_error("invalid_current_password", "Senha atual inválida", status=422)
    if verify_password(current_user.password_hash, payload.new_password):
        return api_error(
            "password_unchanged",
            "A nova senha deve ser diferente da senha atual",
            status=422,
        )
    current_user.password_hash = hash_password(payload.new_password)
    current_user.session_version += 1
    audit_record(
        organization_id=str(current_user.organization_id),
        actor_user_id=str(current_user.id),
        entity_type="user",
        entity_id=str(current_user.id),
        action="password_change",
        after={"sessions_invalidated": True},
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    session["auth_version"] = current_user.session_version
    return ("", 204)


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
