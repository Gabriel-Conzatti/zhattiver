from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import or_, select

from ...core.audit import record
from ...core.errors import BusinessError
from ...core.phones import PhoneNormalizationError, normalize_phone
from ...core.time import DEFAULT_TZ, now_utc, today_local
from ...extensions import db
from ..catalog.models import Insurer
from ..leads.models import Lead
from ..opportunities.models import Opportunity
from ..sales.models import Sale
from ..users.models import ROLE_ADMIN, PermissionGrant, User
from .models import (
    CLAIM_STATUS_CLOSED,
    CLAIM_STATUS_COMPLETED,
    CLAIM_STATUS_FOLLOW_UP,
    CLAIM_STATUS_INSURER,
    CLAIM_STATUS_THIRD_PARTY,
    CLAIM_STATUS_VERIFY,
    ITEM_TYPE_PROPERTY,
    ITEM_TYPE_VEHICLE,
    SERVICE_TYPE_BOTH,
    SERVICE_TYPE_THIRD_PARTY,
    Claim,
    ClaimBranch,
    ClaimEvent,
    ClaimParty,
    ClaimStatus,
    ClaimTask,
    ClaimWorkshop,
)

DEFAULT_STATUSES = (
    ("Em acompanhamento", CLAIM_STATUS_FOLLOW_UP, False),
    ("Verificar", CLAIM_STATUS_VERIFY, False),
    ("Aguardando seguradora", CLAIM_STATUS_INSURER, False),
    ("Aguardando terceiro", CLAIM_STATUS_THIRD_PARTY, False),
    ("Concluído", CLAIM_STATUS_COMPLETED, True),
    ("Finalizado", CLAIM_STATUS_CLOSED, True),
)
PARTY_INSURED = "segurado"
PARTY_THIRD = "terceiro"
# Tolerância para relógios levemente adiantados ao registrar atualização no histórico.
EVENT_FUTURE_TOLERANCE = timedelta(minutes=5)


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


def get_branch(branch_id: str, organization_id: str) -> ClaimBranch:
    branch = db.session.scalar(
        select(ClaimBranch).where(
            ClaimBranch.id == branch_id,
            ClaimBranch.organization_id == organization_id,
            ClaimBranch.is_active.is_(True),
            ClaimBranch.archived_at.is_(None),
        )
    )
    if branch is None:
        raise BusinessError("invalid_branch", "Ramo de sinistro inválido", status=422)
    return branch


def get_insurer(insurer_id: str, organization_id: str) -> Insurer:
    insurer = db.session.scalar(
        select(Insurer).where(
            Insurer.id == insurer_id,
            Insurer.organization_id == organization_id,
            Insurer.is_active.is_(True),
            Insurer.archived_at.is_(None),
        )
    )
    if insurer is None:
        raise BusinessError(
            "invalid_insurer", "Seguradora de sinistro inválida", status=422
        )
    return insurer


def get_workshop(workshop_id: str, organization_id: str) -> ClaimWorkshop:
    workshop = db.session.scalar(
        select(ClaimWorkshop).where(
            ClaimWorkshop.id == workshop_id,
            ClaimWorkshop.organization_id == organization_id,
            ClaimWorkshop.archived_at.is_(None),
        )
    )
    if workshop is None:
        raise BusinessError("invalid_workshop", "Oficina inválida", status=422)
    return workshop


def resolve_claim_catalogs(
    data: dict,
    organization_id: str,
    claim: Claim | None = None,
) -> tuple[ClaimBranch, Insurer, ClaimWorkshop | None]:
    branch_id = data.get("branch_id", claim.branch_id if claim else None)
    insurer_id = data.get("insurer_id", claim.insurer_id if claim else None)
    workshop_id = data.get("workshop_id", claim.workshop_id if claim else None)
    if not branch_id or not insurer_id:
        raise BusinessError(
            "missing_claim_catalog",
            "Ramo e seguradora são obrigatórios",
            status=422,
        )
    branch = get_branch(branch_id, organization_id)
    insurer = get_insurer(insurer_id, organization_id)
    workshop = get_workshop(workshop_id, organization_id) if workshop_id else None
    if workshop is not None and insurer.id not in {
        item.id for item in workshop.insurers
    }:
        raise BusinessError(
            "workshop_insurer_mismatch",
            "A oficina não é referenciada pela seguradora selecionada",
            status=422,
        )
    return branch, insurer, workshop


def initial_status(organization_id: str) -> ClaimStatus:
    statuses = ensure_default_statuses(organization_id)
    return next((status for status in statuses if not status.is_terminal), statuses[0])


def normalize_document(value: str | None) -> str | None:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return None
    if len(digits) not in (11, 14):
        raise BusinessError(
            "invalid_document", "CPF/CNPJ deve ter 11 ou 14 dígitos", status=422
        )
    return digits


def normalize_party_phone(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        return normalize_phone(value)
    except PhoneNormalizationError as exc:
        raise BusinessError("invalid_phone", f"Telefone inválido: {exc}", status=422) from exc


def normalize_item_fields(data: dict) -> dict:
    """Normaliza os dados do item segurado presentes em `data`."""
    result: dict = {}
    if "vehicle_plate" in data:
        plate = re.sub(r"[^A-Z0-9]", "", (data["vehicle_plate"] or "").upper())
        result["vehicle_plate"] = plate or None
    if "vehicle_model" in data:
        result["vehicle_model"] = (data["vehicle_model"] or "").strip() or None
    if "vehicle_year" in data:
        result["vehicle_year"] = data["vehicle_year"]
    if "property_address" in data:
        result["property_address"] = (data["property_address"] or "").strip() or None
    if "coverage" in data:
        result["coverage"] = (data["coverage"] or "").strip() or None
    return result


def has_third_party_service(service_type: str | None) -> bool:
    return service_type in (SERVICE_TYPE_THIRD_PARTY, SERVICE_TYPE_BOTH)


def _validate_opening(data: dict, item: dict, branch: ClaimBranch) -> None:
    insured = next(
        (party for party in data.get("parties", []) if party["role"] == PARTY_INSURED),
        None,
    )
    if insured is None or not insured.get("document") or not insured.get("phone"):
        raise BusinessError(
            "missing_insured",
            "Informe nome, CPF/CNPJ e telefone do segurado",
            status=422,
        )
    if not data.get("service_type"):
        raise BusinessError(
            "missing_service_type", "Informe o tipo de atendimento", status=422
        )
    if not data.get("responsible_user_id"):
        raise BusinessError(
            "missing_responsible", "Informe o responsável pelo sinistro", status=422
        )
    if branch.item_type == ITEM_TYPE_VEHICLE and not (
        item.get("vehicle_plate") and item.get("vehicle_model") and item.get("vehicle_year")
    ):
        raise BusinessError(
            "missing_item", "Informe placa, modelo e ano do veículo", status=422
        )
    if branch.item_type == ITEM_TYPE_PROPERTY and not (
        item.get("property_address") and item.get("coverage")
    ):
        raise BusinessError(
            "missing_item",
            "Informe o endereço e a cobertura acionada",
            status=422,
        )


def _party(organization_id: str, claim_id: str | None, data: dict) -> ClaimParty:
    return ClaimParty(
        organization_id=organization_id,
        claim_id=claim_id,
        role=data["role"],
        name=data["name"].strip(),
        document=normalize_document(data.get("document")),
        phone=normalize_party_phone(data.get("phone")),
        notes=data.get("notes"),
    )


def create_claim(
    *,
    organization_id: str,
    actor_user_id: str,
    data: dict,
    request_id: str | None,
) -> Claim:
    status = (
        get_status(data["status_id"], organization_id)
        if data.get("status_id")
        else initial_status(organization_id)
    )
    branch, insurer, workshop = resolve_claim_catalogs(data, organization_id)
    item = normalize_item_fields(data)
    _validate_opening(data, item, branch)
    validate_links(data, organization_id)
    data = {**data, "opened_on": data.get("opened_on") or today_local()}
    validate_dates(data)
    amount = data.get("indemnified_amount")
    if amount is not None and Decimal(str(amount)) < 0:
        raise BusinessError("invalid_amount", "Valor indenizado não pode ser negativo", status=422)
    parties = [_party(organization_id, None, party) for party in data.get("parties", [])]
    claim = Claim(
        organization_id=organization_id,
        status_id=status.id,
        branch_id=branch.id,
        insurer_id=insurer.id,
        workshop_id=workshop.id if workshop else None,
        responsible_user_id=data.get("responsible_user_id"),
        lead_id=data.get("lead_id"),
        opportunity_id=data.get("opportunity_id"),
        sale_id=data.get("sale_id"),
        claim_number=(data.get("claim_number") or "").strip() or None,
        branch=branch.name,
        insurer=insurer.name,
        service_type=data.get("service_type"),
        has_third_party=has_third_party_service(data.get("service_type"))
        or any(party.role == PARTY_THIRD for party in parties),
        workshop=workshop.name if workshop else None,
        opened_on=data["opened_on"],
        concluded_on=data.get("concluded_on"),
        closed_on=data.get("closed_on"),
        indemnified_on=data.get("indemnified_on"),
        indemnified_amount=amount,
        notes=(data.get("notes") or "").strip() or None,
        **item,
    )
    db.session.add(claim)
    db.session.flush()
    for party in parties:
        party.claim_id = claim.id
        db.session.add(party)
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
    responsible_user_id = data.get("responsible_user_id")
    if responsible_user_id:
        now = now_utc()
        allowed = db.session.scalar(
            select(User.id).where(
                User.id == responsible_user_id,
                User.organization_id == organization_id,
                User.is_active.is_(True),
                User.archived_at.is_(None),
                or_(
                    User.role == ROLE_ADMIN,
                    User.id.in_(
                        select(PermissionGrant.user_id).where(
                            PermissionGrant.organization_id == organization_id,
                            PermissionGrant.permission == "claims.manage",
                            PermissionGrant.revoked_at.is_(None),
                            or_(
                                PermissionGrant.starts_at.is_(None),
                                PermissionGrant.starts_at <= now,
                            ),
                            or_(
                                PermissionGrant.ends_at.is_(None),
                                PermissionGrant.ends_at > now,
                            ),
                        )
                    ),
                ),
            )
        )
        if not allowed:
            raise BusinessError(
                "invalid_claim_assignee",
                "O responsável precisa ter permissão de operação em sinistros",
                status=422,
            )


def validate_dates(data: dict, claim: Claim | None = None) -> None:
    opened_on = data.get("opened_on", claim.opened_on if claim else None)
    if opened_on is None:
        return
    for field, label in (
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
    occurred_at: datetime | None = None,
) -> ClaimEvent:
    event = ClaimEvent(
        organization_id=organization_id,
        claim_id=claim.id,
        actor_user_id=actor_user_id,
        event_type=event_type,
        description=description,
        payload=payload,
        occurred_at=validate_event_time(occurred_at) if occurred_at else now_utc(),
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


def validate_event_time(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=DEFAULT_TZ)
    if value > now_utc() + EVENT_FUTURE_TOLERANCE:
        raise BusinessError(
            "invalid_event_date",
            "A data da atualização não pode estar no futuro",
            status=422,
        )
    return value.astimezone(UTC)


def change_event_time(
    *,
    claim: Claim,
    event: ClaimEvent,
    occurred_at: datetime,
    organization_id: str,
    actor_user_id: str,
    request_id: str | None,
) -> None:
    if event.event_type != "note":
        raise BusinessError(
            "event_not_editable",
            "Somente atualizações registradas manualmente podem ter a data ajustada",
            status=409,
        )
    before = event.occurred_at.isoformat()
    event.occurred_at = validate_event_time(occurred_at)
    record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="claim_event",
        entity_id=str(event.id),
        action="change_date",
        before={"claim_id": str(claim.id), "occurred_at": before},
        after={"claim_id": str(claim.id), "occurred_at": event.occurred_at.isoformat()},
        request_id=request_id,
    )


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
    request_id: str | None,
) -> None:
    validate_links({"responsible_user_id": responsible_user_id}, organization_id)
    before = {
        "responsible_user_id": str(claim.responsible_user_id)
        if claim.responsible_user_id
        else None,
    }
    claim.responsible_user_id = responsible_user_id
    after = {"responsible_user_id": responsible_user_id}
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
    party = _party(organization_id, claim.id, data)
    if party.role == PARTY_THIRD:
        claim.has_third_party = True
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
    owner_user_id = data.get("owner_user_id")
    if owner_user_id and not db.session.scalar(
        select(User.id).where(
            User.id == owner_user_id,
            User.organization_id == organization_id,
            User.is_active.is_(True),
            User.archived_at.is_(None),
        )
    ):
        raise BusinessError("invalid_link", "Responsável fora da organização", status=422)
    task = ClaimTask(
        organization_id=organization_id,
        claim_id=claim.id,
        owner_user_id=owner_user_id,
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
