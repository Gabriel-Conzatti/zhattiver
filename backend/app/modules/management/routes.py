from __future__ import annotations

from datetime import date

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..users.models import ROLE_ADMIN
from . import services
from .models import Absence

bp = Blueprint("management", __name__)


def _require_admin() -> None:
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)


class AbsenceCreate(BaseModel):
    user_id: str
    substitute_user_id: str | None = None
    starts_on: date
    ends_on: date
    reason: str | None = None


class TransferRequest(BaseModel):
    from_user_id: str
    to_user_id: str
    include_schedules: bool = True
    include_next_actions: bool = True
    include_opportunities: bool = False


@bp.get("/admin/absences")
@login_required
def list_absences():
    _require_admin()
    ctx = load_context()
    rows = db.session.execute(
        select(Absence)
        .where(
            Absence.organization_id == ctx.organization_id,
            Absence.archived_at.is_(None),
        )
        .order_by(Absence.starts_on.desc())
        .limit(200)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(a.id),
                    "user_id": str(a.user_id),
                    "substitute_user_id": str(a.substitute_user_id) if a.substitute_user_id else None,
                    "starts_on": a.starts_on.isoformat(),
                    "ends_on": a.ends_on.isoformat(),
                    "reason": a.reason,
                }
                for a in rows
            ]
        }
    )


@bp.post("/admin/absences")
@login_required
def create_absence():
    _require_admin()
    ctx = load_context()
    payload = AbsenceCreate.model_validate(request.get_json(silent=True) or {})
    absence = services.create_absence(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        user_id=payload.user_id,
        substitute_user_id=payload.substitute_user_id,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        reason=payload.reason,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "id": str(absence.id),
            "starts_on": absence.starts_on.isoformat(),
            "ends_on": absence.ends_on.isoformat(),
        }
    ), 201


@bp.post("/admin/transfers")
@login_required
def transfer_workload():
    _require_admin()
    ctx = load_context()
    payload = TransferRequest.model_validate(request.get_json(silent=True) or {})
    result = services.transfer_workload(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        from_user_id=payload.from_user_id,
        to_user_id=payload.to_user_id,
        include_schedules=payload.include_schedules,
        include_next_actions=payload.include_next_actions,
        include_opportunities=payload.include_opportunities,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "schedules": result.schedules,
            "next_actions": result.next_actions,
            "opportunities": result.opportunities,
        }
    )
