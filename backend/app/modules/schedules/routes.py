from __future__ import annotations

from datetime import date

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field
from sqlalchemy import select

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import today_local
from ...extensions import db
from ..leads.models import Lead, LeadPhone
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR
from . import services
from .models import STATE_SCHEDULED, Schedule
from .rules import ScheduleView, contact_limit_on, evaluate_schedule, window_opens_on

bp = Blueprint("schedules", __name__)


class ScheduleCreate(BaseModel):
    lead_id: str
    product_id: str
    coverage_end_date: date
    owner_user_id: str | None = None
    date_confirmed: bool = True
    origin_id: str | None = None
    notes: str | None = None


class ScheduleResolve(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)
    new_date: date
    notes: str | None = None


def _serialize_schedule(schedule: Schedule, view: ScheduleView, *, lead: Lead | None, phone: str | None) -> dict:
    return {
        "id": str(schedule.id),
        "lead_id": str(schedule.lead_id),
        "lead_name": lead.name if lead else None,
        "lead_phone": phone,
        "product_id": str(schedule.product_id),
        "owner_user_id": str(schedule.owner_user_id) if schedule.owner_user_id else None,
        "coverage_end_date": schedule.coverage_end_date.isoformat(),
        "date_confirmed": schedule.date_confirmed,
        "state": schedule.state,
        "origin_id": str(schedule.origin_id) if schedule.origin_id else None,
        "notes": schedule.notes,
        "previous_schedule_id": str(schedule.previous_schedule_id)
        if schedule.previous_schedule_id
        else None,
        "view": {
            "business_days_remaining": view.business_days_remaining,
            "in_window": view.in_window,
            "can_contact": view.can_contact,
            "past_contact_limit": view.past_contact_limit,
            "label": view.label,
            "window_opens_on": window_opens_on(schedule.coverage_end_date).isoformat(),
            "contact_limit_on": contact_limit_on(schedule.coverage_end_date).isoformat(),
        },
    }


@bp.get("/schedules")
@login_required
def list_schedules():
    ctx = load_context()
    scope = request.args.get("scope", "mine")
    filter_ = request.args.get("filter", "all")
    stmt = select(Schedule).where(
        Schedule.organization_id == ctx.organization_id,
        Schedule.archived_at.is_(None),
    )
    if scope == "mine" or ctx.role == ROLE_VENDEDOR:
        stmt = stmt.where(Schedule.owner_user_id == ctx.user_id)
    if filter_ == "active":
        stmt = stmt.where(Schedule.state == STATE_SCHEDULED)
    stmt = stmt.order_by(Schedule.coverage_end_date.asc()).limit(500)
    rows = db.session.execute(stmt).scalars().all()

    lead_ids = list({r.lead_id for r in rows})
    leads_by_id = (
        {
            l.id: l
            for l in db.session.execute(select(Lead).where(Lead.id.in_(lead_ids))).scalars().all()
        }
        if lead_ids
        else {}
    )
    primary_phone: dict[str, str] = {}
    if lead_ids:
        phones = db.session.execute(
            select(LeadPhone)
            .where(LeadPhone.lead_id.in_(lead_ids), LeadPhone.is_primary.is_(True))
        ).scalars().all()
        for p in phones:
            primary_phone[p.lead_id] = p.phone_e164

    today = today_local()
    return jsonify(
        {
            "items": [
                _serialize_schedule(
                    r,
                    evaluate_schedule(r.coverage_end_date, today=today),
                    lead=leads_by_id.get(r.lead_id),
                    phone=primary_phone.get(r.lead_id),
                )
                for r in rows
            ],
            "today": today.isoformat(),
        }
    )


@bp.post("/schedules")
@login_required
def create_schedule():
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Somente admin/SDR", status=403)
    payload = ScheduleCreate.model_validate(request.get_json(silent=True) or {})
    schedule = services.create_schedule(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        lead_id=payload.lead_id,
        product_id=payload.product_id,
        coverage_end_date=payload.coverage_end_date,
        owner_user_id=payload.owner_user_id,
        date_confirmed=payload.date_confirmed,
        origin_id=payload.origin_id,
        notes=payload.notes,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    lead = db.session.get(Lead, schedule.lead_id)
    return (
        jsonify(
            _serialize_schedule(
                schedule,
                evaluate_schedule(schedule.coverage_end_date),
                lead=lead,
                phone=None,
            )
        ),
        201,
    )


@bp.post("/schedules/<schedule_id>/resolve")
@login_required
def resolve(schedule_id: str):
    ctx = load_context()
    schedule = _load(schedule_id, ctx)
    if ctx.role == ROLE_VENDEDOR and schedule.owner_user_id != ctx.user_id:
        raise BusinessError("forbidden", "Agendamento fora do seu escopo", status=403)
    payload = ScheduleResolve.model_validate(request.get_json(silent=True) or {})
    new_schedule = services.resolve_schedule(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        schedule=schedule,
        reason=payload.reason,
        new_date=payload.new_date,
        notes=payload.notes,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    lead = db.session.get(Lead, new_schedule.lead_id)
    return jsonify(
        {
            "previous": _serialize_schedule(
                schedule,
                evaluate_schedule(schedule.coverage_end_date),
                lead=lead,
                phone=None,
            ),
            "next": _serialize_schedule(
                new_schedule,
                evaluate_schedule(new_schedule.coverage_end_date),
                lead=lead,
                phone=None,
            ),
        }
    )


def _load(schedule_id: str, ctx) -> Schedule:
    schedule = db.session.get(Schedule, schedule_id)
    if schedule is None or schedule.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Agendamento não encontrado", status=404)
    return schedule
