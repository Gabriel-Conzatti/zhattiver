from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..notifications.services import notify
from ..opportunities.models import NA_STATE_OPEN, NextAction, Opportunity, STATE_OPEN
from ..schedules.models import STATE_SCHEDULED, Schedule
from ..users.models import User
from .models import Absence


@dataclass
class TransferResult:
    schedules: int
    next_actions: int
    opportunities: int


def create_absence(
    *,
    organization_id: str,
    actor_user_id: str,
    user_id: str,
    substitute_user_id: str | None,
    starts_on: date,
    ends_on: date,
    reason: str | None,
    request_id: str | None = None,
) -> Absence:
    if ends_on < starts_on:
        raise BusinessError("invalid_period", "Data fim antes do início", status=422)
    user = db.session.get(User, user_id)
    if user is None or user.organization_id != organization_id:
        raise BusinessError("not_found", "Usuário ausente não encontrado", status=404)
    if substitute_user_id:
        sub = db.session.get(User, substitute_user_id)
        if sub is None or sub.organization_id != organization_id:
            raise BusinessError("not_found", "Substituto não encontrado", status=404)

    absence = Absence(
        organization_id=organization_id,
        user_id=user_id,
        substitute_user_id=substitute_user_id,
        starts_on=starts_on,
        ends_on=ends_on,
        reason=reason,
    )
    db.session.add(absence)
    db.session.flush()

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="absence",
        entity_id=str(absence.id),
        action="create",
        after={
            "user_id": user_id,
            "substitute_user_id": substitute_user_id,
            "starts_on": starts_on.isoformat(),
            "ends_on": ends_on.isoformat(),
        },
        request_id=request_id,
    )

    # RN-084: notifica envolvidos.
    if substitute_user_id:
        notify(
            organization_id=organization_id,
            user_id=substitute_user_id,
            kind="absence",
            title=f"Você foi definido como substituto de {user.name}",
            body=f"Período: {starts_on.isoformat()} a {ends_on.isoformat()}",
            entity_type="absence",
            entity_id=str(absence.id),
            link_path="/",
            dedup_key=f"absence:{absence.id}",
        )
    return absence


def transfer_workload(
    *,
    organization_id: str,
    actor_user_id: str,
    from_user_id: str,
    to_user_id: str,
    include_schedules: bool = True,
    include_next_actions: bool = True,
    include_opportunities: bool = False,
    request_id: str | None = None,
) -> TransferResult:
    """RN-067: transfere follow-ups (`next_actions`) e agendamentos com data.

    Não altera a meta de prospecção do ausente (RN-068). Oportunidades são transferidas
    somente quando pedido explicitamente (uso administrativo).
    """
    if from_user_id == to_user_id:
        raise BusinessError("same_user", "Origem e destino são iguais", status=422)
    result = TransferResult(schedules=0, next_actions=0, opportunities=0)

    if include_schedules:
        rows = db.session.execute(
            select(Schedule).where(
                Schedule.organization_id == organization_id,
                Schedule.owner_user_id == from_user_id,
                Schedule.state == STATE_SCHEDULED,
                Schedule.archived_at.is_(None),
            )
        ).scalars().all()
        for s in rows:
            s.owner_user_id = to_user_id
            result.schedules += 1

    if include_next_actions:
        rows = db.session.execute(
            select(NextAction).where(
                NextAction.organization_id == organization_id,
                NextAction.owner_user_id == from_user_id,
                NextAction.state == NA_STATE_OPEN,
            )
        ).scalars().all()
        for na in rows:
            na.owner_user_id = to_user_id
            result.next_actions += 1

    if include_opportunities:
        rows = db.session.execute(
            select(Opportunity).where(
                Opportunity.organization_id == organization_id,
                Opportunity.owner_user_id == from_user_id,
                Opportunity.state == STATE_OPEN,
            )
        ).scalars().all()
        for opp in rows:
            opp.owner_user_id = to_user_id
            result.opportunities += 1

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="transfer",
        entity_id=None,
        action="workload",
        after={
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "schedules": result.schedules,
            "next_actions": result.next_actions,
            "opportunities": result.opportunities,
        },
        request_id=request_id,
    )
    # RN-083: notifica destinatário sobre transferência.
    if result.schedules or result.next_actions or result.opportunities:
        notify(
            organization_id=organization_id,
            user_id=to_user_id,
            kind="transfer",
            title="Novas responsabilidades transferidas para você",
            body=(
                f"{result.schedules} agendamento(s), {result.next_actions} follow-up(s), "
                f"{result.opportunities} oportunidade(s)"
            ),
            entity_type="transfer",
            link_path="/",
            dedup_key=f"transfer:{now_utc().isoformat()}:{to_user_id}:{from_user_id}",
        )
    return result
