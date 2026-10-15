from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select

from ...core.audit import record
from ...core.errors import BusinessError
from ...core.time import now_utc, today_local
from ...extensions import db
from ..leads.models import Lead
from ..opportunities.models import Opportunity
from ..sales.models import Sale
from ..users.models import Team, User
from .models import (
    CLAIM_STATUS_CLOSED,
    CLAIM_STATUS_COMPLETED,
    CLAIM_STATUS_FOLLOW_UP,
    CLAIM_STATUS_INSURER,
    CLAIM_STATUS_THIRD_PARTY,
    CLAIM_STATUS_VERIFY,
    Claim,
    ClaimEvent,
    ClaimParty,
    ClaimStatus,
    ClaimTask,
)

DEFAULT_STATUSES = (
    ("Em acompanhamento", CLAIM_STATUS_FOLLOW_UP, False),
    ("Verificar", CLAIM_STATUS_VERIFY, False),
    ("Aguardando seguradora", CLAIM_STATUS_INSURER, False),
    ("Aguardando terceiro", CLAIM_STATUS_THIRD_PARTY, False),
    ("Concluído", CLAIM_STATUS_COMPLETED, True),
    ("Finalizado", CLAIM_STATUS_CLOSED, True),
)


def ensure_default_statuses(organization_id: str) -> list[ClaimStatus]:
    statuses = list(
        db.session.execute(
            select(ClaimStatus)
            .where(
                ClaimStatus.organization_id == organization_id,
                ClaimStatus.is_active.is_(True),
            )
            .order_by(ClaimStatus.sort_order, ClaimStatus.name)
        ).scalars()
    )
    if statuses:
        return statuses
    statuses = [
        ClaimStatus(
            organization_id=organization_id,
            name=name,
            slug=slug,
            sort_order=index,
            is_terminal=terminal,
        )
        for index, (name, slug, terminal) in enumerate(DEFAULT_STATUSES)
    ]
    db.session.add_all(statuses)
    db.session.flush()
    return statuses


def get_status(status_id: str, organization_id: str) -> ClaimStatus:
    status = db.session.scalar(
        select(ClaimStatus).where(
            ClaimStatus.id == status_id,
            ClaimStatus.organization_id == organization_id,
            ClaimStatus.is_active.is_(True),
        )
    )
    if not status:
        raise BusinessError("invalid_status", "Status de sinistro inválido", status=422)
    return status


def create_claim(
    *,
    organization_id: str,
    actor_user_id: str,
    data: dict,
    request_id: str | None,
) -> Claim:
    status = get_status(data["status_id"], organization_id)
    validate_links(data, organization_id)
    validate_dates(data)
    amount = data.get("indemnified_amount")
    if amount is not None and Decimal(str(amount)) < 0:
        raise BusinessError("invalid_amount", "Valor indenizado não pode ser negativo", status=422)
    claim = Claim(
        organization_id=organization_id,
        status_id=status.id,
        team_id=data.get("team_id"),
        responsible_user_id=data.get("responsible_user_id"),
        lead_id=data.get("lead_id"),
        opportunity_id=data.get("opportunity_id"),
        sale_id=data.get("sale_id"),
        claim_number=(data.get("claim_number") or "").strip() or None,
        branch=data["branch"].strip(),
        insurer=data["insurer"].strip(),
        service_type=(data.get("service_type") or "").strip() or None,
        has_third_party=data.get("has_third_party", False),
        workshop=(data.get("workshop") or "").strip() or None,
        opened_on=data["opened_on"],
        expected_on=data.get("expected_on"),
        concluded_on=data.get("concluded_on"),
        closed_on=data.get("closed_on"),
        indemnified_on=data.get("indemnified_on"),
        indemnified_amount=amount,
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(claim)
    db.session.flush()
    for party in data.get("parties", []):
        db.session.add(
            ClaimParty(
                organization_id=organization_id,
                claim_id=claim.id,
                role=party["role"],
                name=party["name"],
                phone=party.get("phone"),
                notes=party.get("notes"),
            )
        )
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="created",
        description="Sinistro criado",
        request_id=request_id,
    )
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim",
        entity_id=str(claim.id),
        action="create",
        after={"status": status.slug, "branch": claim.branch, "insurer": claim.insurer},
        request_id=request_id,
    )
    return claim


def validate_links(data: dict, organization_id: str) -> None:
    checks = (
        ("responsible_user_id", User, "Usuário responsável"),
        ("team_id", Team, "Equipe"),
        ("lead_id", Lead, "Lead"),
        ("opportunity_id", Opportunity, "Oportunidade"),
        ("sale_id", Sale, "Venda"),
    )
    for field, model, label in checks:
        value = data.get(field)
        if value and not db.session.scalar(
            select(model).where(model.id == value, model.organization_id == organization_id)
        ):
            raise BusinessError("invalid_link", f"{label} fora da organização", status=422)


def validate_dates(data: dict, claim: Claim | None = None) -> None:
    opened_on = data.get("opened_on", claim.opened_on if claim else None)
    if opened_on is None:
        return
    for field, label in (
        ("expected_on", "previsão"),
        ("concluded_on", "conclusão"),
        ("closed_on", "encerramento"),
        ("indemnified_on", "indenização"),
    ):
        value = data.get(field, getattr(claim, field, None) if claim else None)
        if value is not None and value < opened_on:
            raise BusinessError(
                "invalid_date",
                f"A data de {label} não pode ser anterior à abertura",
                status=422,
            )


def add_event(
    *,
    claim: Claim,
    organization_id: str,
    actor_user_id: str,
    event_type: str,
    description: str,
    request_id: str | None = None,
    payload: dict | None = None,
) -> ClaimEvent:
    event = ClaimEvent(
        organization_id=organization_id,
        claim_id=claim.id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        description=description,
        payload=payload,
        occurred_at=now_utc(),
    )
    db.session.add(event)
    db.session.flush()
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim_event",
        entity_id=str(event.id),
        action="create",
        after={"claim_id": str(claim.id), "event_type": event_type},
        request_id=request_id,
    )
    return event


def change_status(
    *,
    claim: Claim,
    status: ClaimStatus,
    organization_id: str,
    actor_user_id: str,
    request_id: str | None,
) -> None:
    old = claim.status_id
    claim.status_id = status.id
    if status.is_terminal and not claim.concluded_on:
        claim.concluded_on = today_local()
    if status.slug == CLAIM_STATUS_CLOSED and not claim.closed_on:
        claim.closed_on = today_local()
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="status_changed",
        description=f"Status alterado para {status.name}",
        request_id=request_id,
        payload={"from_status_id": str(old), "to_status_id": str(status.id)},
    )
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim",
        entity_id=str(claim.id),
        action="status_change",
        before={"status_id": str(old)},
        after={"status_id": str(status.id), "status": status.slug},
        request_id=request_id,
    )


def assign_claim(
    *,
    claim: Claim,
    organization_id: str,
    actor_user_id: str,
    responsible_user_id: str | None,
    team_id: str | None,
    request_id: str | None,
) -> None:
    validate_links(
        {
            "responsible_user_id": responsible_user_id,
            "team_id": team_id,
        },
        organization_id,
    )
    before = {
        "responsible_user_id": str(claim.responsible_user_id)
        if claim.responsible_user_id
        else None,
        "team_id": str(claim.team_id) if claim.team_id else None,
    }
    claim.responsible_user_id = responsible_user_id
    claim.team_id = team_id
    after = {
        "responsible_user_id": responsible_user_id,
        "team_id": team_id,
    }
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="assigned",
        description="Responsável pelo sinistro atualizado",
        request_id=request_id,
        payload={"before": before, "after": after},
    )
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim",
        entity_id=str(claim.id),
        action="assign",
        before=before,
        after=after,
        request_id=request_id,
    )


def add_party(
    *,
    claim: Claim,
    organization_id: str,
    actor_user_id: str,
    data: dict,
    request_id: str | None,
) -> ClaimParty:
    party = ClaimParty(
        organization_id=organization_id,
        claim_id=claim.id,
        role=data["role"],
        name=data["name"],
        phone=data.get("phone"),
        notes=data.get("notes"),
    )
    db.session.add(party)
    db.session.flush()
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="party_added",
        description=f"Participante adicionado: {party.role}",
        request_id=request_id,
    )
    return party


def add_task(
    *,
    claim: Claim,
    organization_id: str,
    actor_user_id: str,
    data: dict,
    request_id: str | None,
) -> ClaimTask:
    task = ClaimTask(
        organization_id=organization_id,
        claim_id=claim.id,
        owner_user_id=data.get("owner_user_id"),
        title=data["title"],
        due_on=data.get("due_on"),
        priority=data.get("priority", "normal"),
    )
    db.session.add(task)
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="task_created",
        description=f"Tarefa criada: {task.title}",
        request_id=request_id,
    )
    return task


def set_task_completion(
    *,
    claim: Claim,
    task: ClaimTask,
    done: bool,
    organization_id: str,
    actor_user_id: str,
    request_id: str | None,
) -> None:
    was_done = task.done_at is not None
    if was_done == done:
        return
    task.done_at = now_utc() if done else None
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="task_completed" if done else "task_reopened",
        description=f"Tarefa {'concluída' if done else 'reaberta'}: {task.title}",
        request_id=request_id,
    )
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim_task",
        entity_id=str(task.id),
        action="complete" if done else "reopen",
        before={"done": was_done},
        after={"done": done},
        request_id=request_id,
    )


def archive_claim(
    *,
    claim: Claim,
    organization_id: str,
    actor_user_id: str,
    reason: str,
    request_id: str | None,
) -> None:
    if claim.archived_at is not None:
        return
    claim.archived_at = now_utc()
    add_event(
        claim=claim,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        event_type="archived",
        description="Sinistro arquivado",
        request_id=request_id,
        payload={"reason": reason},
    )
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim",
        entity_id=str(claim.id),
        action="archive",
        reason=reason,
        request_id=request_id,
    )
