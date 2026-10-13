from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_login import login_required
from sqlalchemy import func, select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..users.models import ROLE_ADMIN
from .models import AuditLog

bp = Blueprint("audit", __name__)


def _paging() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        per_page = min(200, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        per_page = 25
    return page, per_page


@bp.get("/audit")
@login_required
def list_audit_logs():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)

    page, per_page = _paging()
    stmt = select(AuditLog).where(AuditLog.organization_id == ctx.organization_id)
    for field, column in (
        ("actor_user_id", AuditLog.actor_user_id),
        ("entity_type", AuditLog.entity_type),
        ("entity_id", AuditLog.entity_id),
        ("action", AuditLog.action),
    ):
        value = (request.args.get(field) or "").strip()
        if value:
            stmt = stmt.where(column == value)

    total = db.session.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()
    rows = db.session.execute(
        stmt.order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": entry.id,
                    "actor_user_id": str(entry.actor_user_id) if entry.actor_user_id else None,
                    "entity_type": entry.entity_type,
                    "entity_id": str(entry.entity_id) if entry.entity_id else None,
                    "action": entry.action,
                    "before": entry.before,
                    "after": entry.after,
                    "reason": entry.reason,
                    "occurred_at": entry.occurred_at.isoformat(),
                }
                for entry in rows
            ],
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    )
