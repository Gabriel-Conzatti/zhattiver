from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.calendar import follow_up_due_date
from ...core.errors import BusinessError
from ...core.time import DEFAULT_TZ, now_utc, to_local, today_local
from ...extensions import db
from ..funnel.models import Funnel, FunnelStage
from ..funnel.rendering import render_template
from ..leads.models import Availability, Lead
from ..schedules.models import STATE_CONTACTED, Schedule
from ..users.models import Product, User
from .models import (
    Activity,
    LossReason,
    NextAction,
    Opportunity,
    RELEVANT_ACTIVITY_TYPES,
    STATE_LOST,
    STATE_OPEN,
    STATE_WON,
    TYPE_CALL,
    TYPE_CONTACT,
    TYPE_COPY_MESSAGE,
    TYPE_NEXT_ACTION_CREATED,
    TYPE_NEXT_ACTION_DONE,
    TYPE_NOTE,
    TYPE_RESPONSE,
    TYPE_RESULT,
    TYPE_SCHEDULE_CONTACT,
    TYPE_STAGE_CHANGE,
    NA_STATE_DONE,
    NA_STATE_OPEN,
)


METRIC_PROSPECTING = "prospecting"
METRIC_SCHEDULES = "schedules"
METRIC_FOLLOWUPS = "followups"


@dataclass
class CopyMessageResult:
    opportunity: Opportunity
    message: str
    activity: Activity
    counted: bool  # True quando conta para meta diária (primeiro contato)
    reused: bool  # True quando idempotency_key repetido


def _default_funnel(organization_id: str, product_id: str) -> Funnel:
    stmt = (
        select(Funnel)
        .where(
            Funnel.organization_id == organization_id,
            Funnel.product_id == product_id,
            Funnel.archived_at.is_(None),
        )
        .order_by(Funnel.is_default.desc(), Funnel.created_at.asc())
    )
    funnel = db.session.execute(stmt).scalar_one_or_none()
    if funnel is None:
        raise BusinessError(
            "no_funnel",
            "Nenhum funil configurado para este produto",
            status=422,
        )
    return funnel


def _initial_stage(funnel_id: str) -> FunnelStage:
    stmt = (
        select(FunnelStage)
        .where(FunnelStage.funnel_id == funnel_id, FunnelStage.archived_at.is_(None))
        .order_by(FunnelStage.is_initial.desc(), FunnelStage.order_index.asc())
    )
    stage = db.session.execute(stmt).scalar_one_or_none()
    if stage is None:
        raise BusinessError(
            "no_initial_stage", "Funil sem etapas configuradas", status=422
        )
    return stage


def render_message_for_opportunity(
    opportunity: Opportunity, stage: FunnelStage, *, actor: User, lead: Lead
) -> str:
    variables = {
        "nome_cliente": lead.name,
        "nome_vendedor": actor.name,
        "nome_indicador": lead.indicator_name or "",
    }
    return render_template(stage.message_template, variables)


def _resolve_metric(
    activity_type: str,
    *,
    origin: str | None,
    schedule_id: str | None,
) -> str | None:
    """Define para qual meta a atividade conta (RN-006/RN-014)."""
    if activity_type == TYPE_COPY_MESSAGE:
        if schedule_id or origin == "schedule":
            return METRIC_SCHEDULES
        return METRIC_PROSPECTING
    return None


def copy_message(
    *,
    organization_id: str,
    actor_user_id: str,
    lead_id: str,
    product_id: str,
    idempotency_key: str,
    schedule_id: str | None = None,
    origin: str | None = None,
    request_id: str | None = None,
) -> CopyMessageResult:
    """RN-006/007: registra o clique em "Copiar mensagem".

    - Se `idempotency_key` já foi usado, devolve o resultado anterior (não conta duas vezes).
    - Cria a oportunidade se ainda não existe uma aberta para o (lead, produto).
    - Marca a availability como reivindicada (RN-006).
    - `counts_for_daily_metric` é preenchido apenas na primeira cópia do ciclo (RN-007).
    """
    if not idempotency_key:
        raise BusinessError("missing_idempotency_key", "Idempotency-Key obrigatório", status=422)

    # Trava por chave idempotente
    existing = db.session.execute(
        select(Activity).where(
            Activity.organization_id == organization_id,
            Activity.idempotency_key == idempotency_key,
        )
    ).scalar_one_or_none()

    if existing is not None:
        opportunity = db.session.get(Opportunity, existing.opportunity_id)
        message = existing.payload.get("message", "") if existing.payload else ""
        return CopyMessageResult(
            opportunity=opportunity,
            message=message,
            activity=existing,
            counted=existing.counts_for_daily_metric is not None,
            reused=True,
        )

    lead = db.session.get(Lead, lead_id)
    if lead is None or lead.organization_id != organization_id:
        raise BusinessError("not_found", "Lead não encontrado", status=404)
    if lead.archived_at is not None:
        raise BusinessError("archived_lead", "Lead arquivado", status=409)

    product = db.session.get(Product, product_id)
    if product is None or product.organization_id != organization_id:
        raise BusinessError("not_found", "Produto não encontrado", status=404)

    actor = db.session.get(User, actor_user_id)

    funnel = _default_funnel(organization_id, product_id)
    stage = _initial_stage(funnel.id)

    # Tenta pegar oportunidade aberta existente (RN-065)
    opportunity = db.session.execute(
        select(Opportunity)
        .where(
            Opportunity.organization_id == organization_id,
            Opportunity.lead_id == lead_id,
            Opportunity.product_id == product_id,
            Opportunity.state == STATE_OPEN,
        )
        .with_for_update()
    ).scalar_one_or_none()

    availability: Availability | None = None
    schedule: Schedule | None = None
    is_new_opportunity = False

    if opportunity is None:
        # Cria a oportunidade a partir da availability aberta (se houver).
        availability = db.session.execute(
            select(Availability)
            .where(
                Availability.organization_id == organization_id,
                Availability.lead_id == lead_id,
                Availability.product_id == product_id,
                Availability.claimed_at.is_(None),
                Availability.archived_at.is_(None),
            )
            .with_for_update()
        ).scalar_one_or_none()

        if schedule_id:
            schedule = db.session.get(Schedule, schedule_id)
            if schedule is None or schedule.organization_id != organization_id:
                raise BusinessError("not_found", "Agendamento não encontrado", status=404)

        opportunity = Opportunity(
            organization_id=organization_id,
            lead_id=lead_id,
            product_id=product_id,
            funnel_id=funnel.id,
            current_stage_id=stage.id,
            owner_user_id=actor_user_id,
            state=STATE_OPEN,
            origin=origin or (availability.origin_id if availability and availability.origin_id else None) or (
                "schedule" if schedule else None
            ),
            source_availability_id=availability.id if availability else None,
            source_schedule_id=schedule.id if schedule else None,
            opened_at=now_utc(),
            last_relevant_at=now_utc(),
        )
        db.session.add(opportunity)
        db.session.flush()
        is_new_opportunity = True

        if availability is not None:
            availability.claimed_by = actor_user_id
            availability.claimed_at = now_utc()

        if schedule is not None:
            schedule.state = STATE_CONTACTED
            schedule.contacted_opportunity_id = opportunity.id

    message = render_message_for_opportunity(opportunity, stage, actor=actor, lead=lead)

    counts_for = _resolve_metric(
        TYPE_COPY_MESSAGE,
        origin=opportunity.origin,
        schedule_id=str(schedule.id) if schedule else (
            str(opportunity.source_schedule_id) if opportunity.source_schedule_id else None
        ),
    )
    # RN-007: contagem única por ciclo — só na criação da oportunidade.
    if not is_new_opportunity:
        counts_for = None

    activity = Activity(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=lead_id,
        schedule_id=schedule.id if schedule else None,
        type=TYPE_COPY_MESSAGE if not schedule else TYPE_SCHEDULE_CONTACT,
        payload={"message": message, "stage_id": str(stage.id)},
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        idempotency_key=idempotency_key,
        counts_for_daily_metric=counts_for,
        occurred_at=now_utc(),
    )
    db.session.add(activity)

    # Atualiza relógio de acompanhamento (RN-019)
    opportunity.last_relevant_at = activity.occurred_at

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action="copy_message" if is_new_opportunity else "recopy_message",
        after={"counts_for": counts_for, "reused_opportunity": not is_new_opportunity},
        request_id=request_id,
    )
    return CopyMessageResult(
        opportunity=opportunity,
        message=message,
        activity=activity,
        counted=counts_for is not None,
        reused=False,
    )


# --- Metas diárias -----------------------------------------------------------

@dataclass
class DailyGoals:
    prospecting: tuple[int, int]  # (done, target)
    schedules: tuple[int, int]
    followups: tuple[int, int]
    closes_at_hour: int


def _prospecting_quota(user_id: str, on: date) -> int:
    from ..goals.models import DailyProspectingQuota

    stmt = (
        select(DailyProspectingQuota)
        .where(
            DailyProspectingQuota.user_id == user_id,
            DailyProspectingQuota.effective_from <= on,
        )
        .order_by(DailyProspectingQuota.effective_from.desc())
    )
    rows = db.session.execute(stmt).scalars().all()
    for q in rows:
        if q.effective_to is None or q.effective_to >= on:
            return q.quota
    return 0


def compute_daily_goals(
    *, organization_id: str, user_id: str, close_hour: int, today: date | None = None
) -> DailyGoals:
    from ...core.time import end_of_day_utc, start_of_day_utc

    today = today or today_local(DEFAULT_TZ)
    start_utc = start_of_day_utc(today, DEFAULT_TZ)
    end_utc = end_of_day_utc(today, DEFAULT_TZ)

    from sqlalchemy import func

    prospecting_done = db.session.execute(
        select(func.count(Activity.id)).where(
            Activity.organization_id == organization_id,
            Activity.beneficiary_user_id == user_id,
            Activity.counts_for_daily_metric == METRIC_PROSPECTING,
            Activity.occurred_at >= start_utc,
            Activity.occurred_at <= end_utc,
        )
    ).scalar_one()

    schedules_done = db.session.execute(
        select(func.count(Activity.id)).where(
            Activity.organization_id == organization_id,
            Activity.beneficiary_user_id == user_id,
            Activity.counts_for_daily_metric == METRIC_SCHEDULES,
            Activity.occurred_at >= start_utc,
            Activity.occurred_at <= end_utc,
        )
    ).scalar_one()

    from ..schedules.rules import evaluate_schedule
    from ..schedules.models import STATE_SCHEDULED

    schedules_open = db.session.execute(
        select(Schedule).where(
            Schedule.organization_id == organization_id,
            Schedule.owner_user_id == user_id,
            Schedule.state == STATE_SCHEDULED,
            Schedule.archived_at.is_(None),
        )
    ).scalars().all()
    schedules_target = sum(
        1
        for s in schedules_open
        if evaluate_schedule(s.coverage_end_date, today=today).in_window
        or evaluate_schedule(s.coverage_end_date, today=today).past_contact_limit
    )

    # RN-021: alvo = follow-ups pendentes (hoje + atrasados abertos).
    pending = compute_pending_followups(
        organization_id=organization_id, user_id=user_id, today=today
    )
    followups_target = len(pending)
    # "Feito" = oportunidades do vendedor com atividade relevante hoje.
    done_row = db.session.execute(
        select(func.count(func.distinct(Activity.opportunity_id))).where(
            Activity.organization_id == organization_id,
            Activity.beneficiary_user_id == user_id,
            Activity.type.in_(list(RELEVANT_ACTIVITY_TYPES)),
            Activity.occurred_at >= start_utc,
            Activity.occurred_at <= end_utc,
        )
    ).scalar_one()
    followups_done = min(followups_target, int(done_row or 0))

    return DailyGoals(
        prospecting=(prospecting_done, _prospecting_quota(user_id, today)),
        schedules=(schedules_done, schedules_target),
        followups=(followups_done, followups_target),
        closes_at_hour=close_hour,
    )


# --- Encerramento da oportunidade -------------------------------------------

def win_opportunity(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    request_id: str | None = None,
) -> None:
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state != STATE_OPEN:
        raise BusinessError("invalid_state", "Oportunidade já encerrada", status=409)
    previous = opportunity.state
    opportunity.state = STATE_WON
    opportunity.closed_at = now_utc()
    opportunity.last_relevant_at = now_utc()
    _close_open_next_actions(opportunity)
    _record_activity_row(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=opportunity.lead_id,
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        activity_type=TYPE_RESULT,
        payload={"state": STATE_WON},
    )
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action="win",
        before={"state": previous},
        after={"state": STATE_WON},
        request_id=request_id,
    )


def lose_opportunity(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    loss_reason_id: str,
    justification: str,
    request_id: str | None = None,
) -> None:
    """RN-053/054: perda exige motivo + justificativa textual obrigatória."""
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state != STATE_OPEN:
        raise BusinessError("invalid_state", "Oportunidade já encerrada", status=409)
    if not loss_reason_id:
        raise BusinessError("missing_loss_reason", "Motivo é obrigatório", status=422)
    justification = (justification or "").strip()
    if len(justification) < 3:
        raise BusinessError(
            "missing_justification", "Justificativa é obrigatória (mín. 3 chars)", status=422
        )

    reason = db.session.get(LossReason, loss_reason_id)
    if reason is None or reason.organization_id != organization_id:
        raise BusinessError("not_found", "Motivo não encontrado", status=404)

    previous = opportunity.state
    opportunity.state = STATE_LOST
    opportunity.closed_at = now_utc()
    opportunity.last_relevant_at = now_utc()
    opportunity.loss_reason_id = reason.id
    opportunity.loss_justification = justification
    _close_open_next_actions(opportunity)

    _record_activity_row(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=opportunity.lead_id,
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        activity_type=TYPE_RESULT,
        payload={
            "state": STATE_LOST,
            "loss_reason": reason.name,
            "justification": justification,
        },
    )
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action="lose",
        before={"state": previous},
        after={"state": STATE_LOST, "loss_reason": reason.name},
        reason=justification,
        request_id=request_id,
    )


def _close_open_next_actions(opportunity: Opportunity) -> None:
    for na in db.session.execute(
        select(NextAction).where(
            NextAction.opportunity_id == opportunity.id,
            NextAction.state == NA_STATE_OPEN,
        )
    ).scalars().all():
        na.state = "cancelled"


# --- Atividades genéricas ---------------------------------------------------

_MANUAL_ACTIVITY_TYPES = {TYPE_CONTACT, TYPE_CALL, TYPE_RESPONSE, TYPE_NOTE}


def record_manual_activity(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    activity_type: str,
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    request_id: str | None = None,
) -> Activity:
    """Registra contato/ligação/resposta/observação (RN-019/024)."""
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state != STATE_OPEN:
        raise BusinessError("invalid_state", "Oportunidade encerrada", status=409)
    if activity_type not in _MANUAL_ACTIVITY_TYPES:
        raise BusinessError("invalid_type", "Tipo de atividade inválido", status=422)

    if idempotency_key:
        existing = db.session.execute(
            select(Activity).where(
                Activity.organization_id == organization_id,
                Activity.idempotency_key == idempotency_key,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    activity = _record_activity_row(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=opportunity.lead_id,
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        activity_type=activity_type,
        payload=payload or {},
        idempotency_key=idempotency_key,
    )

    if activity_type in RELEVANT_ACTIVITY_TYPES:
        opportunity.last_relevant_at = activity.occurred_at
        # Se havia próxima ação aberta, marca como cumprida (a mais próxima).
        na = db.session.execute(
            select(NextAction)
            .where(
                NextAction.opportunity_id == opportunity.id,
                NextAction.state == NA_STATE_OPEN,
            )
            .order_by(NextAction.due_at.asc())
        ).scalar_one_or_none()
        if na is not None:
            na.state = NA_STATE_DONE
            na.done_at = activity.occurred_at
            na.done_activity_id = activity.id

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action=f"activity.{activity_type}",
        after={"payload": payload},
        request_id=request_id,
    )
    return activity


def _record_activity_row(
    *,
    organization_id: str,
    opportunity_id: str,
    lead_id: str | None,
    actor_user_id: str,
    beneficiary_user_id: str | None,
    activity_type: str,
    payload: dict[str, Any] | None,
    idempotency_key: str | None = None,
    counts_for_daily_metric: str | None = None,
    schedule_id: str | None = None,
) -> Activity:
    activity = Activity(
        organization_id=organization_id,
        opportunity_id=opportunity_id,
        lead_id=lead_id,
        schedule_id=schedule_id,
        type=activity_type,
        payload=payload or {},
        actor_user_id=actor_user_id,
        beneficiary_user_id=beneficiary_user_id,
        idempotency_key=idempotency_key,
        counts_for_daily_metric=counts_for_daily_metric,
        occurred_at=now_utc(),
    )
    db.session.add(activity)
    db.session.flush()
    return activity


# --- Mudança de etapa -------------------------------------------------------

def change_stage(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    new_stage_id: str,
    request_id: str | None = None,
) -> None:
    """RN-024: mudança livre para qualquer etapa do funil."""
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state != STATE_OPEN:
        raise BusinessError("invalid_state", "Oportunidade encerrada", status=409)
    stage = db.session.get(FunnelStage, new_stage_id)
    if stage is None or stage.funnel_id != opportunity.funnel_id:
        raise BusinessError("invalid_stage", "Etapa fora do funil", status=422)
    if str(opportunity.current_stage_id) == str(stage.id):
        return
    previous = opportunity.current_stage_id
    opportunity.current_stage_id = stage.id
    opportunity.last_relevant_at = now_utc()
    _record_activity_row(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=opportunity.lead_id,
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        activity_type=TYPE_STAGE_CHANGE,
        payload={"from": str(previous), "to": str(stage.id), "to_name": stage.name},
    )
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action="stage_change",
        before={"stage_id": str(previous)},
        after={"stage_id": str(stage.id)},
        request_id=request_id,
    )


# --- Próximas ações ---------------------------------------------------------

def create_next_action(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    action_type: str,
    due_at: datetime,
    notes: str | None = None,
    origin: str = "manual",
    generation_key: str | None = None,
    request_id: str | None = None,
) -> NextAction:
    """Cria uma próxima ação (RN-018/022) e reinicia o relógio (RN-019)."""
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state != STATE_OPEN:
        raise BusinessError("invalid_state", "Oportunidade encerrada", status=409)

    if generation_key:
        existing = db.session.execute(
            select(NextAction).where(
                NextAction.organization_id == organization_id,
                NextAction.generation_key == generation_key,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    na = NextAction(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        type=action_type,
        due_at=due_at,
        owner_user_id=opportunity.owner_user_id,
        state=NA_STATE_OPEN,
        origin=origin,
        generation_key=generation_key,
        notes=(notes or None),
    )
    db.session.add(na)
    db.session.flush()

    opportunity.last_relevant_at = now_utc()
    _record_activity_row(
        organization_id=organization_id,
        opportunity_id=opportunity.id,
        lead_id=opportunity.lead_id,
        actor_user_id=actor_user_id,
        beneficiary_user_id=opportunity.owner_user_id,
        activity_type=TYPE_NEXT_ACTION_CREATED,
        payload={
            "next_action_id": str(na.id),
            "type": action_type,
            "due_at": due_at.isoformat(),
            "origin": origin,
        },
    )
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="next_action",
        entity_id=str(na.id),
        action="create",
        after={"type": action_type, "due_at": due_at.isoformat(), "origin": origin},
        request_id=request_id,
    )
    return na


def mark_next_action_done(
    *,
    organization_id: str,
    actor_user_id: str,
    next_action: NextAction,
    request_id: str | None = None,
) -> None:
    if next_action.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if next_action.state != NA_STATE_OPEN:
        raise BusinessError("invalid_state", "Ação já concluída", status=409)
    next_action.state = NA_STATE_DONE
    next_action.done_at = now_utc()
    opportunity = db.session.get(Opportunity, next_action.opportunity_id)
    if opportunity is not None:
        opportunity.last_relevant_at = now_utc()
        _record_activity_row(
            organization_id=organization_id,
            opportunity_id=opportunity.id,
            lead_id=opportunity.lead_id,
            actor_user_id=actor_user_id,
            beneficiary_user_id=opportunity.owner_user_id,
            activity_type=TYPE_NEXT_ACTION_DONE,
            payload={"next_action_id": str(next_action.id), "type": next_action.type},
        )
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="next_action",
        entity_id=str(next_action.id),
        action="done",
        request_id=request_id,
    )


# --- Reciclagem -------------------------------------------------------------

def recycle_opportunity(
    *,
    organization_id: str,
    actor_user_id: str,
    opportunity: Opportunity,
    new_date: date,
    notes: str | None = None,
    date_confirmed: bool = False,
    request_id: str | None = None,
) -> Schedule:
    """RN-056..RN-059: transforma uma oportunidade perdida em novo agendamento.

    Preserva o histórico da tentativa anterior e cria um novo Schedule vinculado.
    Se o `opportunity.state` for `open`, ela é marcada como perdida por reciclagem —
    mas o caminho comum é reciclar após uma perda regular.
    """
    if opportunity.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if opportunity.state == STATE_WON:
        raise BusinessError("invalid_state", "Oportunidade ganha não recicla", status=409)
    if new_date is None:
        raise BusinessError("missing_date", "Nova data é obrigatória", status=422)

    # Deriva o agendamento anterior para vincular o histórico (RN-059).
    previous_schedule_id = opportunity.source_schedule_id

    from ..schedules import services as schedule_services

    schedule = schedule_services.create_schedule(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        lead_id=opportunity.lead_id,
        product_id=opportunity.product_id,
        coverage_end_date=new_date,
        owner_user_id=opportunity.owner_user_id,
        date_confirmed=date_confirmed,
        origin_id=None,
        notes=notes,
        previous_schedule_id=previous_schedule_id,
        request_id=request_id,
    )
    opportunity.recycled_to_schedule_id = schedule.id
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="opportunity",
        entity_id=str(opportunity.id),
        action="recycle",
        after={
            "new_schedule_id": str(schedule.id),
            "new_date": new_date.isoformat(),
        },
        request_id=request_id,
    )
    return schedule


def suggest_recycle_date(previous: date) -> date:
    """RN-057: sugere mesma data no próximo ano; trata 29/02."""
    year = previous.year + 1
    month = previous.month
    day = previous.day
    try:
        return date(year, month, day)
    except ValueError:
        # 29/02 → 28/02 no ano seguinte não bissexto
        return date(year, month, 28)


# --- Follow-ups automáticos (RN-016/017/018/020) ---------------------------

def compute_pending_followups(
    *,
    organization_id: str,
    user_id: str,
    today: date | None = None,
) -> list[Opportunity]:
    """Retorna oportunidades ativas do vendedor cuja `follow_up_due_date` já venceu.

    RN-016/017: 24h corridas desde a última atualização relevante + próximo dia útil.
    RN-018: se existe próxima ação `open`, o follow-up é suprimido.
    RN-020: itens vencidos permanecem até serem resolvidos; não duplicamos.
    """
    today = today or today_local(DEFAULT_TZ)
    opps = db.session.execute(
        select(Opportunity).where(
            Opportunity.organization_id == organization_id,
            Opportunity.owner_user_id == user_id,
            Opportunity.state == STATE_OPEN,
            Opportunity.archived_at.is_(None),
        )
    ).scalars().all()

    if not opps:
        return []

    opp_ids = [o.id for o in opps]
    with_actions = {
        na.opportunity_id
        for na in db.session.execute(
            select(NextAction).where(
                NextAction.opportunity_id.in_(opp_ids),
                NextAction.state == NA_STATE_OPEN,
            )
        ).scalars().all()
    }
    result: list[Opportunity] = []
    for o in opps:
        if o.id in with_actions:
            continue
        local = to_local(o.last_relevant_at)
        due = follow_up_due_date(local.date(), o.organization_id)
        if due <= today:
            result.append(o)
    return result


def generate_daily_followups(
    *, organization_id: str, today: date | None = None
) -> int:
    """Materializa follow-ups pendentes como `NextAction` (origem=auto).

    Idempotente por `generation_key`; o job diário pode ser reexecutado sem duplicar.
    Retorna o total criado.
    """
    today = today or today_local(DEFAULT_TZ)
    open_opps = db.session.execute(
        select(Opportunity).where(
            Opportunity.organization_id == organization_id,
            Opportunity.state == STATE_OPEN,
            Opportunity.archived_at.is_(None),
        )
    ).scalars().all()
    if not open_opps:
        return 0

    ids = [o.id for o in open_opps]
    with_open_actions = {
        na.opportunity_id
        for na in db.session.execute(
            select(NextAction).where(
                NextAction.opportunity_id.in_(ids),
                NextAction.state == NA_STATE_OPEN,
            )
        ).scalars().all()
    }

    created = 0
    for o in open_opps:
        if o.id in with_open_actions:
            continue
        local = to_local(o.last_relevant_at)
        due = follow_up_due_date(local.date(), organization_id)
        if due > today:
            continue
        # Chave estável por (oportunidade, dia devido) — garante idempotência.
        key = f"followup-auto:{o.id}:{due.isoformat()}"
        existing = db.session.execute(
            select(NextAction).where(
                NextAction.organization_id == organization_id,
                NextAction.generation_key == key,
            )
        ).scalar_one_or_none()
        if existing is not None:
            continue
        # `due_at` em UTC = 09:00 local do dia devido
        due_local = datetime.combine(due, datetime.min.time().replace(hour=9), tzinfo=DEFAULT_TZ)
        na = NextAction(
            organization_id=organization_id,
            opportunity_id=o.id,
            type="followup",
            due_at=due_local,
            owner_user_id=o.owner_user_id,
            state=NA_STATE_OPEN,
            origin="auto",
            generation_key=key,
        )
        db.session.add(na)
        created += 1
    return created
