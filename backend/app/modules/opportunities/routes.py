from __future__ import annotations

from datetime import date, datetime, timezone

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...extensions import db
from ..funnel.models import FunnelStage
from ..leads.models import Lead
from ..users.models import ROLE_SDR, ROLE_VENDEDOR
from . import services
from .models import (
    Activity,
    LossReason,
    NextAction,
    NextActionType,
    Opportunity,
    STATE_OPEN,
    NA_STATE_OPEN,
)

bp = Blueprint("opportunities", __name__)


class CopyMessageRequest(BaseModel):
    lead_id: str
    product_id: str
    idempotency_key: str = Field(min_length=8, max_length=120)
    schedule_id: str | None = None
    origin: str | None = None


def _serialize_opportunity(
    opp: Opportunity,
    *,
    include_message: str | None = None,
    lead_name: str | None = None,
    stage_name: str | None = None,
) -> dict:
    return {
        "id": str(opp.id),
        "lead_id": str(opp.lead_id),
        "lead_name": lead_name,
        "stage_name": stage_name,
        "product_id": str(opp.product_id),
        "funnel_id": str(opp.funnel_id),
        "current_stage_id": str(opp.current_stage_id),
        "owner_user_id": str(opp.owner_user_id),
        "state": opp.state,
        "origin": opp.origin,
        "opened_at": opp.opened_at.isoformat(),
        "closed_at": opp.closed_at.isoformat() if opp.closed_at else None,
        "last_relevant_at": opp.last_relevant_at.isoformat(),
        "loss_reason_id": str(opp.loss_reason_id) if opp.loss_reason_id else None,
        "loss_justification": opp.loss_justification,
        "recycled_to_schedule_id": str(opp.recycled_to_schedule_id)
        if opp.recycled_to_schedule_id
        else None,
        "message": include_message,
    }


# --------------- Copiar mensagem (RN-006/007) --------------------------------

@bp.post("/opportunities/copy-message")
@login_required
def copy_message():
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não trabalha oportunidades", status=403)
    payload = CopyMessageRequest.model_validate(request.get_json(silent=True) or {})
    if ctx.role == ROLE_VENDEDOR and payload.product_id not in ctx.product_ids:
        raise BusinessError("forbidden", "Produto fora do seu escopo", status=403)
    result = services.copy_message(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        lead_id=payload.lead_id,
        product_id=payload.product_id,
        idempotency_key=payload.idempotency_key,
        schedule_id=payload.schedule_id,
        origin=payload.origin,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "opportunity": _serialize_opportunity(result.opportunity, include_message=result.message),
            "counted": result.counted,
            "reused": result.reused,
        }
    ), (200 if result.reused else 201)


# --------------- Win / Lose / Recycle ----------------------------------------

class LoseRequest(BaseModel):
    loss_reason_id: str
    justification: str = Field(min_length=3, max_length=2000)


class RecycleRequest(BaseModel):
    new_date: date
    notes: str | None = None
    date_confirmed: bool = False


@bp.post("/opportunities/<opp_id>/win")
@login_required
def win(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    services.win_opportunity(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_opportunity(opp))


@bp.post("/opportunities/<opp_id>/lose")
@login_required
def lose(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    payload = LoseRequest.model_validate(request.get_json(silent=True) or {})
    services.lose_opportunity(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        loss_reason_id=payload.loss_reason_id,
        justification=payload.justification,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_opportunity(opp))


@bp.post("/opportunities/<opp_id>/recycle")
@login_required
def recycle(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    payload = RecycleRequest.model_validate(request.get_json(silent=True) or {})
    schedule = services.recycle_opportunity(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        new_date=payload.new_date,
        notes=payload.notes,
        date_confirmed=payload.date_confirmed,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "opportunity": _serialize_opportunity(opp),
            "schedule_id": str(schedule.id),
            "coverage_end_date": schedule.coverage_end_date.isoformat(),
        }
    ), 201


# --------------- Mudança de etapa --------------------------------------------

class StageChange(BaseModel):
    stage_id: str


@bp.post("/opportunities/<opp_id>/stage")
@login_required
def change_stage(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    payload = StageChange.model_validate(request.get_json(silent=True) or {})
    services.change_stage(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        new_stage_id=payload.stage_id,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_opportunity(opp))


# --------------- Atividades manuais ------------------------------------------

_MANUAL_TYPES = {"contact", "call", "response", "note"}


class ActivityRequest(BaseModel):
    type: str
    text: str | None = None
    idempotency_key: str | None = None


@bp.post("/opportunities/<opp_id>/activities")
@login_required
def create_activity(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    payload = ActivityRequest.model_validate(request.get_json(silent=True) or {})
    if payload.type not in _MANUAL_TYPES:
        raise BusinessError("invalid_type", "Tipo de atividade inválido", status=422)
    activity = services.record_manual_activity(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        activity_type=payload.type,
        payload={"text": (payload.text or "").strip() or None} if payload.text else {},
        idempotency_key=payload.idempotency_key,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {"id": str(activity.id), "type": activity.type, "occurred_at": activity.occurred_at.isoformat()}
    ), 201


# --------------- Próximas ações ---------------------------------------------

class NextActionRequest(BaseModel):
    type: str
    due_at: datetime
    notes: str | None = None


@bp.post("/opportunities/<opp_id>/next-actions")
@login_required
def create_next_action(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    payload = NextActionRequest.model_validate(request.get_json(silent=True) or {})
    due = payload.due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    na = services.create_next_action(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        opportunity=opp,
        action_type=payload.type.strip().lower(),
        due_at=due,
        notes=payload.notes,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(
        {
            "id": str(na.id),
            "type": na.type,
            "due_at": na.due_at.isoformat(),
            "state": na.state,
            "notes": na.notes,
            "origin": na.origin,
        }
    ), 201


@bp.post("/next-actions/<na_id>/done")
@login_required
def mark_next_action_done(na_id: str):
    ctx = load_context()
    na = db.session.get(NextAction, na_id)
    if na is None or na.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Ação não encontrada", status=404)
    if ctx.role == ROLE_VENDEDOR and na.owner_user_id != ctx.user_id:
        raise BusinessError("forbidden", "Ação fora do seu escopo", status=403)
    services.mark_next_action_done(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        next_action=na,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(na.id), "state": na.state, "done_at": na.done_at.isoformat()})


# --------------- Listagem e detalhe -----------------------------------------

@bp.get("/opportunities")
@login_required
def list_opportunities():
    ctx = load_context()
    state = request.args.get("state", STATE_OPEN)
    scope = request.args.get("scope", "mine")
    stmt = select(Opportunity).where(
        Opportunity.organization_id == ctx.organization_id,
        Opportunity.archived_at.is_(None),
    )
    if state:
        stmt = stmt.where(Opportunity.state == state)
    if scope == "mine" or ctx.role == ROLE_VENDEDOR:
        stmt = stmt.where(Opportunity.owner_user_id == ctx.user_id)
    stmt = stmt.order_by(Opportunity.last_relevant_at.desc()).limit(200)
    opps = db.session.execute(stmt).scalars().all()

    lead_ids = list({o.lead_id for o in opps})
    stage_ids = list({o.current_stage_id for o in opps})
    leads_by_id = (
        {l.id: l for l in db.session.execute(select(Lead).where(Lead.id.in_(lead_ids))).scalars().all()}
        if lead_ids
        else {}
    )
    stages_by_id = (
        {
            s.id: s
            for s in db.session.execute(
                select(FunnelStage).where(FunnelStage.id.in_(stage_ids))
            ).scalars().all()
        }
        if stage_ids
        else {}
    )

    return jsonify(
        {
            "items": [
                _serialize_opportunity(
                    o,
                    lead_name=leads_by_id.get(o.lead_id).name if leads_by_id.get(o.lead_id) else None,
                    stage_name=stages_by_id.get(o.current_stage_id).name
                    if stages_by_id.get(o.current_stage_id)
                    else None,
                )
                for o in opps
            ]
        }
    )


@bp.get("/opportunities/<opp_id>")
@login_required
def get_opportunity(opp_id: str):
    ctx = load_context()
    opp = _load_owned_opportunity(opp_id, ctx)
    lead = db.session.get(Lead, opp.lead_id)
    stage = db.session.get(FunnelStage, opp.current_stage_id)
    stages = db.session.execute(
        select(FunnelStage)
        .where(FunnelStage.funnel_id == opp.funnel_id, FunnelStage.archived_at.is_(None))
        .order_by(FunnelStage.order_index.asc())
    ).scalars().all()
    activities = db.session.execute(
        select(Activity)
        .where(Activity.opportunity_id == opp.id)
        .order_by(Activity.occurred_at.desc())
        .limit(200)
    ).scalars().all()
    next_actions = db.session.execute(
        select(NextAction)
        .where(NextAction.opportunity_id == opp.id)
        .order_by(NextAction.due_at.asc())
    ).scalars().all()
    return jsonify(
        {
            "opportunity": _serialize_opportunity(
                opp,
                lead_name=lead.name if lead else None,
                stage_name=stage.name if stage else None,
            ),
            "lead": {
                "id": str(lead.id) if lead else None,
                "name": lead.name if lead else None,
                "city": lead.city if lead else None,
                "state": lead.state if lead else None,
            },
            "stages": [
                {"id": str(s.id), "name": s.name, "order_index": s.order_index}
                for s in stages
            ],
            "activities": [
                {
                    "id": str(a.id),
                    "type": a.type,
                    "occurred_at": a.occurred_at.isoformat(),
                    "actor_user_id": str(a.actor_user_id),
                    "payload": a.payload,
                }
                for a in activities
            ],
            "next_actions": [
                {
                    "id": str(na.id),
                    "type": na.type,
                    "due_at": na.due_at.isoformat(),
                    "state": na.state,
                    "origin": na.origin,
                    "notes": na.notes,
                    "done_at": na.done_at.isoformat() if na.done_at else None,
                }
                for na in next_actions
            ],
        }
    )


# --------------- Follow-ups do vendedor -------------------------------------

@bp.get("/me/followups")
@login_required
def my_followups():
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não tem follow-ups", status=403)

    pending = services.compute_pending_followups(
        organization_id=ctx.organization_id, user_id=ctx.user_id
    )
    next_actions = db.session.execute(
        select(NextAction)
        .where(
            NextAction.organization_id == ctx.organization_id,
            NextAction.owner_user_id == ctx.user_id,
            NextAction.state == NA_STATE_OPEN,
        )
        .order_by(NextAction.due_at.asc())
    ).scalars().all()

    lead_ids = list({o.lead_id for o in pending})
    leads_by_id = (
        {l.id: l for l in db.session.execute(select(Lead).where(Lead.id.in_(lead_ids))).scalars().all()}
        if lead_ids
        else {}
    )
    return jsonify(
        {
            "pending": [
                {
                    "opportunity_id": str(o.id),
                    "lead_name": leads_by_id.get(o.lead_id).name if leads_by_id.get(o.lead_id) else None,
                    "last_relevant_at": o.last_relevant_at.isoformat(),
                }
                for o in pending
            ],
            "next_actions": [
                {
                    "id": str(na.id),
                    "opportunity_id": str(na.opportunity_id),
                    "type": na.type,
                    "due_at": na.due_at.isoformat(),
                    "origin": na.origin,
                    "notes": na.notes,
                }
                for na in next_actions
            ],
        }
    )


# --------------- Metas diárias ----------------------------------------------

@bp.get("/me/goals/today")
@login_required
def my_goals():
    from flask import current_app

    ctx = load_context()
    goals = services.compute_daily_goals(
        organization_id=ctx.organization_id,
        user_id=ctx.user_id,
        close_hour=int(current_app.config["LYNK_DAILY_METAS_CLOSE_HOUR"]),
    )
    return jsonify(
        {
            "prospecting": {"done": goals.prospecting[0], "target": goals.prospecting[1]},
            "schedules": {"done": goals.schedules[0], "target": goals.schedules[1]},
            "followups": {"done": goals.followups[0], "target": goals.followups[1]},
            "closes_at_hour": goals.closes_at_hour,
        }
    )


# --------------- Catálogos: motivos e tipos de próxima ação -----------------

@bp.get("/loss-reasons")
@login_required
def list_loss_reasons():
    ctx = load_context()
    rows = db.session.execute(
        select(LossReason)
        .where(LossReason.organization_id == ctx.organization_id, LossReason.is_active.is_(True))
        .order_by(LossReason.name)
    ).scalars().all()
    return jsonify({"items": [{"id": str(r.id), "name": r.name} for r in rows]})


@bp.get("/next-action-types")
@login_required
def list_next_action_types():
    ctx = load_context()
    rows = db.session.execute(
        select(NextActionType)
        .where(NextActionType.organization_id == ctx.organization_id, NextActionType.is_active.is_(True))
        .order_by(NextActionType.name)
    ).scalars().all()
    return jsonify({"items": [{"id": str(r.id), "name": r.name, "slug": r.slug} for r in rows]})


def _load_owned_opportunity(opp_id: str, ctx) -> Opportunity:
    opp = db.session.get(Opportunity, opp_id)
    if opp is None or opp.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Oportunidade não encontrada", status=404)
    if ctx.role == ROLE_VENDEDOR and opp.owner_user_id != ctx.user_id:
        raise BusinessError("forbidden", "Oportunidade fora do seu escopo", status=403)
    return opp
