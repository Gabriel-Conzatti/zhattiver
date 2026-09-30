from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from .models import STATE_CANCELLED, STATE_RESOLVED, STATE_SCHEDULED, Schedule


def create_schedule(
    *,
    organization_id: str,
    actor_user_id: str,
    lead_id: str,
    product_id: str,
    coverage_end_date: date,
    owner_user_id: str | None,
    date_confirmed: bool = True,
    origin_id: str | None = None,
    notes: str | None = None,
    previous_schedule_id: str | None = None,
    request_id: str | None = None,
) -> Schedule:
    if coverage_end_date is None:
        raise BusinessError("missing_date", "Data final da vigência é obrigatória", status=422)
    schedule = Schedule(
        organization_id=organization_id,
        lead_id=lead_id,
        product_id=product_id,
        owner_user_id=owner_user_id,
        coverage_end_date=coverage_end_date,
        date_confirmed=date_confirmed,
        origin_id=origin_id,
        notes=notes,
        previous_schedule_id=previous_schedule_id,
        state=STATE_SCHEDULED,
    )
    db.session.add(schedule)
    db.session.flush()
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="schedule",
        entity_id=str(schedule.id),
        action="create",
        after={
            "coverage_end_date": coverage_end_date.isoformat(),
            "product_id": product_id,
            "owner_user_id": owner_user_id,
            "date_confirmed": date_confirmed,
        },
        request_id=request_id,
    )
    return schedule


def resolve_schedule(
    *,
    organization_id: str,
    actor_user_id: str,
    schedule: Schedule,
    reason: str,
    new_date: date,
    notes: str | None = None,
    request_id: str | None = None,
) -> Schedule:
    """RN-012/013: um agendamento não trabalhado passa a exigir Resolução.

    A resolução exige justificativa + nova data e gera um agendamento futuro
    vinculado ao anterior. O item antigo é marcado como resolvido.
    """
    if schedule.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if schedule.state in (STATE_RESOLVED, STATE_CANCELLED):
        raise BusinessError("invalid_state", "Agendamento já resolvido", status=409)
    if not reason or not reason.strip():
        raise BusinessError("missing_reason", "Justificativa é obrigatória", status=422)
    if new_date is None:
        raise BusinessError("missing_date", "Nova data é obrigatória", status=422)

    schedule.state = STATE_RESOLVED
    schedule.resolved_at = now_utc()
    schedule.resolved_reason = reason.strip()
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="schedule",
        entity_id=str(schedule.id),
        action="resolve",
        before={"state": STATE_SCHEDULED},
        after={"state": STATE_RESOLVED, "new_date": new_date.isoformat()},
        reason=reason,
        request_id=request_id,
    )
    new_schedule = create_schedule(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        lead_id=schedule.lead_id,
        product_id=schedule.product_id,
        coverage_end_date=new_date,
        owner_user_id=schedule.owner_user_id,
        date_confirmed=False,
        origin_id=schedule.origin_id,
        notes=notes or schedule.notes,
        previous_schedule_id=schedule.id,
        request_id=request_id,
    )
    return new_schedule


def list_active_for_user(
    *, organization_id: str, user_id: str, only_today: bool = False, today: date | None = None
) -> list[Schedule]:
    stmt = (
        select(Schedule)
        .where(
            Schedule.organization_id == organization_id,
            Schedule.owner_user_id == user_id,
            Schedule.state == STATE_SCHEDULED,
            Schedule.archived_at.is_(None),
        )
        .order_by(Schedule.coverage_end_date.asc())
    )
    rows = db.session.execute(stmt).scalars().all()
    return list(rows)
