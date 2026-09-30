from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_login import login_required
from sqlalchemy import func, select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from .models import Notification

bp = Blueprint("notifications", __name__)


def _serialize(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "link_path": n.link_path,
        "data": n.data,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat(),
    }


@bp.get("/notifications")
@login_required
def list_notifications():
    ctx = load_context()
    unread_only = request.args.get("unread", "false").lower() == "true"
    stmt = select(Notification).where(
        Notification.organization_id == ctx.organization_id,
        Notification.user_id == ctx.user_id,
    )
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(50)
    rows = db.session.execute(stmt).scalars().all()
    unread_count = db.session.execute(
        select(func.count(Notification.id)).where(
            Notification.organization_id == ctx.organization_id,
            Notification.user_id == ctx.user_id,
            Notification.read_at.is_(None),
        )
    ).scalar_one()
    return jsonify({"items": [_serialize(n) for n in rows], "unread_count": unread_count})


@bp.post("/notifications/<notification_id>/read")
@login_required
def mark_read(notification_id: str):
    ctx = load_context()
    n = db.session.get(Notification, notification_id)
    if n is None or n.organization_id != ctx.organization_id or str(n.user_id) != ctx.user_id:
        raise BusinessError("not_found", "Notificação não encontrada", status=404)
    if n.read_at is None:
        n.read_at = now_utc()
    db.session.commit()
    return jsonify(_serialize(n))


@bp.post("/notifications/read-all")
@login_required
def mark_all_read():
    ctx = load_context()
    db.session.execute(
        Notification.__table__.update()
        .where(
            Notification.organization_id == ctx.organization_id,
            Notification.user_id == ctx.user_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=now_utc())
    )
    db.session.commit()
    return ("", 204)
