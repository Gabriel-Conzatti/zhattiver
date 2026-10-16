from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import exists, func, or_, select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.phones import PhoneNormalizationError, normalize_phone
from ...core.time import now_utc, today_local
from ...extensions import db
from ..catalog.models import Insurer
from ..opportunities.models import Opportunity
from ..sales.models import Sale
from ..users.models import (
    ROLE_ADMIN,
    ROLE_VENDEDOR,
    PermissionGrant,
    User,
)
from . import services
from .models import (
    SERVICE_TYPES,
    Claim,
    ClaimBranch,
    ClaimEvent,
    ClaimInsurerProfile,
    ClaimParty,
    ClaimStatus,
    ClaimTask,
    ClaimWorkshop,
)

bp = Blueprint("claims", __name__)

ServiceType = Literal[SERVICE_TYPES]  # type: ignore[valid-type]


class PartyInput(BaseModel):
    role: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=1, max_length=200)
    document: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=1000)


class ItemFields(BaseModel):
    vehicle_plate: str | None = Field(default=None, max_length=10)
    vehicle_model: str | None = Field(default=None, max_length=120)
    vehicle_year: int | None = Field(default=None, ge=1900, le=2100)
    property_address: str | None = Field(default=None, max_length=500)
    coverage: str | None = Field(default=None, max_length=120)


class ClaimInput(ItemFields):
    model_config = ConfigDict(extra="forbid")

    status_id: str | None = None
    branch_id: str
    insurer_id: str
    workshop_id: str | None = None
    opened_on: date | None = None
    claim_number: str | None = Field(default=None, max_length=100)
    responsible_user_id: str | None = None
    lead_id: str | None = None
    opportunity_id: str | None = None
    sale_id: str | None = None
    service_type: ServiceType | None = None
    concluded_on: date | None = None
    closed_on: date | None = None
    indemnified_on: date | None = None
    indemnified_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=10000)
    parties: list[PartyInput] = Field(default_factory=list, max_length=20)


class StatusInput(BaseModel):
    status_id: str


class ClaimUpdate(ItemFields):
    model_config = ConfigDict(extra="forbid")

    branch_id: str | None = None
    insurer_id: str | None = None
    workshop_id: str | None = None
    opened_on: date | None = None
    lead_id: str | None = None
    opportunity_id: str | None = None
    sale_id: str | None = None
    claim_number: str | None = Field(default=None, max_length=100)
    service_type: ServiceType | None = None
    concluded_on: date | None = None
    closed_on: date | None = None
    indemnified_on: date | None = None
    indemnified_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=10000)


class EventInput(BaseModel):
    description: str = Field(min_length=1, max_length=2000)
    occurred_at: datetime | None = None


class EventDateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    occurred_at: datetime


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    owner_user_id: str | None = None
    due_on: date | None = None
    priority: str = Field(default="normal", pattern="^(low|normal|high)$")


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    done: bool


class AssignmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    responsible_user_id: str | None = None


class InsurerProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contacts: str | None = Field(default=None, max_length=5000)
    rental_car_contact: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=20000)


class ArchiveInput(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class StatusCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(pattern=r"^[a-z0-9_]+$", min_length=1, max_length=80)
    sort_order: int = Field(default=0, ge=0)
    is_terminal: bool = False


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    sort_order: int | None = Field(default=None, ge=0)
    is_terminal: bool | None = None
    is_active: bool | None = None


class WorkshopCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    address: str = Field(min_length=1, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    responsible_name: str = Field(min_length=1, max_length=200)
    insurer_ids: list[str] = Field(min_length=1, max_length=50)


class WorkshopUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=200)
    insurer_ids: list[str] | None = Field(default=None, min_length=1, max_length=50)


def _can_manage(ctx) -> bool:
    return ctx.role == ROLE_ADMIN or "claims.manage" in ctx.grants


def _can_read(ctx) -> bool:
    return (
        ctx.role == ROLE_ADMIN
        or "claims.read" in ctx.grants
        or "claims.manage" in ctx.grants
    )


def _can_view_financial(ctx) -> bool:
    return _can_manage(ctx) or "claims.view_financial" in ctx.grants


def _claim_query(ctx):
    stmt = select(Claim).where(
        Claim.organization_id == ctx.organization_id,
        Claim.archived_at.is_(None),
    )
    if ctx.role == ROLE_VENDEDOR and not _can_manage(ctx):
        owned_opportunities = select(Opportunity.id).where(
            Opportunity.organization_id == ctx.organization_id,
            Opportunity.owner_user_id == ctx.user_id,
        )
        opportunity_leads = select(Opportunity.lead_id).where(
            Opportunity.organization_id == ctx.organization_id,
            Opportunity.owner_user_id == ctx.user_id,
        )
        owned_sales = select(Sale.id).where(
            Sale.organization_id == ctx.organization_id,
            Sale.seller_user_id == ctx.user_id,
        )
        sale_leads = select(Sale.lead_id).where(
            Sale.organization_id == ctx.organization_id,
            Sale.seller_user_id == ctx.user_id,
        )
        stmt = stmt.where(
            or_(
                Claim.opportunity_id.in_(owned_opportunities),
                Claim.sale_id.in_(owned_sales),
                Claim.lead_id.in_(opportunity_leads),
                Claim.lead_id.in_(sale_leads),
            )
        )
    return stmt


def _paging() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        per_page = 25
    return page, per_page


def _load_claim(claim_id: str, ctx) -> Claim:
    claim = db.session.scalar(_claim_query(ctx).where(Claim.id == claim_id))
    if not claim:
        raise BusinessError("not_found", "Sinistro não encontrado", status=404)
    return claim


def _terminal_status_ids(organization_id: str):
    return select(ClaimStatus.id).where(
        ClaimStatus.organization_id == organization_id,
        ClaimStatus.is_terminal.is_(True),
    )


def _summaries(claim_ids: list[str]) -> dict[str, dict]:
    """Nome do segurado e próximo acompanhamento em aberto, em lote."""
    result: dict[str, dict] = {
        claim_id: {"insured_name": None, "next_follow_up_on": None}
        for claim_id in claim_ids
    }
    if not claim_ids:
        return result
    for party in db.session.scalars(
        select(ClaimParty)
        .where(
            ClaimParty.claim_id.in_(claim_ids),
            ClaimParty.role == services.PARTY_INSURED,
        )
        .order_by(ClaimParty.created_at)
    ):
        summary = result[str(party.claim_id)]
        summary["insured_name"] = summary["insured_name"] or party.name
    for claim_id, due_on in db.session.execute(
        select(ClaimTask.claim_id, func.min(ClaimTask.due_on))
        .where(
            ClaimTask.claim_id.in_(claim_ids),
            ClaimTask.done_at.is_(None),
            ClaimTask.due_on.is_not(None),
        )
        .group_by(ClaimTask.claim_id)
    ):
        result[str(claim_id)]["next_follow_up_on"] = due_on.isoformat()
    return result


def _serialize(claim: Claim, ctx, summary: dict | None = None) -> dict:
    status = db.session.get(ClaimStatus, claim.status_id)
    summary = summary if summary is not None else _summaries([str(claim.id)])[str(claim.id)]
    return {
        "id": str(claim.id),
        "status_id": str(claim.status_id),
        "branch_id": str(claim.branch_id),
        "insurer_id": str(claim.insurer_id),
        "workshop_id": str(claim.workshop_id) if claim.workshop_id else None,
        "status": status.slug if status else None,
        "status_name": status.name if status else None,
        "is_closed": bool(status and status.is_terminal),
        "insured_name": summary["insured_name"],
        "next_follow_up_on": summary["next_follow_up_on"],
        "responsible_user_id": str(claim.responsible_user_id) if claim.responsible_user_id else None,
        "lead_id": str(claim.lead_id) if claim.lead_id else None,
        "opportunity_id": str(claim.opportunity_id) if claim.opportunity_id else None,
        "sale_id": str(claim.sale_id) if claim.sale_id else None,
        "claim_number": claim.claim_number,
        "branch": claim.branch,
        "insurer": claim.insurer,
        "service_type": claim.service_type,
        "has_third_party": claim.has_third_party,
        "workshop": claim.workshop,
        "vehicle_plate": claim.vehicle_plate,
        "vehicle_model": claim.vehicle_model,
        "vehicle_year": claim.vehicle_year,
        "property_address": claim.property_address,
        "coverage": claim.coverage,
        "opened_on": claim.opened_on.isoformat(),
        "concluded_on": claim.concluded_on.isoformat() if claim.concluded_on else None,
        "closed_on": claim.closed_on.isoformat() if claim.closed_on else None,
        "indemnified_on": claim.indemnified_on.isoformat() if claim.indemnified_on else None,
        "indemnified_amount": (
            str(claim.indemnified_amount)
            if claim.indemnified_amount is not None and _can_view_financial(ctx)
            else None
        ),
        "notes": claim.notes,
        "created_at": claim.created_at.isoformat(),
        "updated_at": claim.updated_at.isoformat(),
    }


def _serialize_workshop(workshop: ClaimWorkshop) -> dict:
    return {
        "id": str(workshop.id),
        "name": workshop.name,
        "phone": workshop.phone,
        "address": workshop.address,
        "city": workshop.city,
        "responsible_name": workshop.responsible_name,
        "insurer_ids": [str(insurer.id) for insurer in workshop.insurers],
    }


def _workshop_insurers(insurer_ids: list[str], organization_id: str) -> list[Insurer]:
    unique_ids = set(insurer_ids)
    insurers = list(
        db.session.scalars(
            select(Insurer).where(
                Insurer.organization_id == organization_id,
                Insurer.id.in_(unique_ids),
                Insurer.is_active.is_(True),
                Insurer.archived_at.is_(None),
            )
        )
    )
    if len(insurers) != len(unique_ids):
        raise BusinessError(
            "invalid_insurer",
            "Uma ou mais seguradoras não pertencem à organização",
            status=422,
        )
    return insurers


def _workshop_phone(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        return normalize_phone(value)
    except PhoneNormalizationError as exc:
        raise BusinessError(
            "invalid_phone", f"Telefone da oficina inválido: {exc}", status=422
        ) from exc


def _detail(claim: Claim, ctx) -> dict:
    result = _serialize(claim, ctx)
    result["parties"] = [
        {
            "id": str(p.id),
            "role": p.role,
            "name": p.name,
            "document": p.document,
            "phone": p.phone,
            "notes": p.notes,
        }
        for p in db.session.scalars(
            select(ClaimParty)
            .where(
                ClaimParty.organization_id == claim.organization_id,
                ClaimParty.claim_id == claim.id,
            )
            .order_by(ClaimParty.created_at)
        )
    ]
    result["events"] = [
        {
            "id": str(event.id),
            "event_type": event.event_type,
            "description": event.description,
            "occurred_at": event.occurred_at.isoformat(),
            "editable": event.event_type == "note",
        }
        for event in db.session.scalars(
            select(ClaimEvent)
            .where(
                ClaimEvent.organization_id == claim.organization_id,
                ClaimEvent.claim_id == claim.id,
            )
            .order_by(ClaimEvent.occurred_at.desc())
        )
    ]
    result["tasks"] = [
        {
            "id": str(task.id),
            "title": task.title,
            "owner_user_id": str(task.owner_user_id) if task.owner_user_id else None,
            "due_on": task.due_on.isoformat() if task.due_on else None,
            "priority": task.priority,
            "done_at": task.done_at.isoformat() if task.done_at else None,
        }
        for task in db.session.scalars(
            select(ClaimTask)
            .where(
                ClaimTask.organization_id == claim.organization_id,
                ClaimTask.claim_id == claim.id,
            )
            .order_by(ClaimTask.done_at, ClaimTask.due_on)
        )
    ]
    return result


@bp.get("/claims/catalogs")
@login_required
def list_claim_catalogs():
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    branches = db.session.scalars(
        select(ClaimBranch)
        .where(
            ClaimBranch.organization_id == ctx.organization_id,
            ClaimBranch.is_active.is_(True),
            ClaimBranch.archived_at.is_(None),
        )
        .order_by(ClaimBranch.name)
    ).all()
    insurers = db.session.scalars(
        select(Insurer)
        .where(
            Insurer.organization_id == ctx.organization_id,
            Insurer.is_active.is_(True),
            Insurer.archived_at.is_(None),
        )
        .order_by(Insurer.name)
    ).all()
    workshops = db.session.scalars(
        select(ClaimWorkshop)
        .where(
            ClaimWorkshop.organization_id == ctx.organization_id,
            ClaimWorkshop.archived_at.is_(None),
        )
        .order_by(ClaimWorkshop.name)
    ).all()
    return jsonify(
        {
            "branches": [
                {"id": str(branch.id), "name": branch.name, "item_type": branch.item_type}
                for branch in branches
            ],
            "insurers": [
                {"id": str(insurer.id), "name": insurer.name}
                for insurer in insurers
            ],
            "workshops": [_serialize_workshop(workshop) for workshop in workshops],
        }
    )


@bp.post("/claims/workshops")
@login_required
def create_workshop():
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError(
            "forbidden", "Sem permissão para cadastrar oficinas", status=403
        )
    payload = WorkshopCreate.model_validate(request.get_json(silent=True) or {})
    name = payload.name.strip()
    duplicate = db.session.scalar(
        select(ClaimWorkshop.id).where(
            ClaimWorkshop.organization_id == ctx.organization_id,
            func.lower(ClaimWorkshop.name) == name.lower(),
            ClaimWorkshop.archived_at.is_(None),
        )
    )
    if duplicate:
        raise BusinessError(
            "duplicate_workshop", "Já existe uma oficina com esse nome", status=409
        )
    workshop = ClaimWorkshop(
        organization_id=ctx.organization_id,
        name=name,
        phone=_workshop_phone(payload.phone),
        address=payload.address.strip(),
        city=(payload.city or "").strip() or None,
        responsible_name=payload.responsible_name.strip(),
        insurers=_workshop_insurers(payload.insurer_ids, ctx.organization_id),
    )
    db.session.add(workshop)
    db.session.flush()
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_workshop",
        entity_id=str(workshop.id),
        action="create",
        after=_serialize_workshop(workshop),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_workshop(workshop)), 201


@bp.patch("/claims/workshops/<workshop_id>")
@login_required
def update_workshop(workshop_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError(
            "forbidden", "Sem permissão para editar oficinas", status=403
        )
    workshop = db.session.scalar(
        select(ClaimWorkshop).where(
            ClaimWorkshop.id == workshop_id,
            ClaimWorkshop.organization_id == ctx.organization_id,
            ClaimWorkshop.archived_at.is_(None),
        )
    )
    if workshop is None:
        raise BusinessError("not_found", "Oficina não encontrada", status=404)
    payload = WorkshopUpdate.model_validate(request.get_json(silent=True) or {})
    changes = payload.model_dump(exclude_unset=True)
    before = _serialize_workshop(workshop)
    if "name" in changes:
        name = changes["name"].strip()
        duplicate = db.session.scalar(
            select(ClaimWorkshop.id).where(
                ClaimWorkshop.organization_id == ctx.organization_id,
                func.lower(ClaimWorkshop.name) == name.lower(),
                ClaimWorkshop.id != workshop.id,
                ClaimWorkshop.archived_at.is_(None),
            )
        )
        if duplicate:
            raise BusinessError(
                "duplicate_workshop", "Já existe uma oficina com esse nome", status=409
            )
        workshop.name = name
    if "phone" in changes:
        workshop.phone = _workshop_phone(changes["phone"])
    if "address" in changes:
        workshop.address = changes["address"].strip()
    if "city" in changes:
        workshop.city = (changes["city"] or "").strip() or None
    if "responsible_name" in changes:
        workshop.responsible_name = changes["responsible_name"].strip()
    if "insurer_ids" in changes:
        workshop.insurers = _workshop_insurers(
            changes["insurer_ids"], ctx.organization_id
        )
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_workshop",
        entity_id=str(workshop.id),
        action="update",
        before=before,
        after=_serialize_workshop(workshop),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_serialize_workshop(workshop))


@bp.post("/claims/workshops/<workshop_id>/archive")
@login_required
def archive_workshop(workshop_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError(
            "forbidden", "Sem permissão para arquivar oficinas", status=403
        )
    workshop = db.session.scalar(
        select(ClaimWorkshop).where(
            ClaimWorkshop.id == workshop_id,
            ClaimWorkshop.organization_id == ctx.organization_id,
            ClaimWorkshop.archived_at.is_(None),
        )
    )
    if workshop is None:
        raise BusinessError("not_found", "Oficina não encontrada", status=404)
    workshop.archived_at = now_utc()
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_workshop",
        entity_id=str(workshop.id),
        action="archive",
        before=_serialize_workshop(workshop),
        after={"archived_at": workshop.archived_at.isoformat()},
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return "", 204


@bp.get("/claims/statuses")
@login_required
def list_statuses():
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    statuses = db.session.scalars(
        select(ClaimStatus)
        .where(
            ClaimStatus.organization_id == ctx.organization_id,
            ClaimStatus.is_active.is_(True),
        )
        .order_by(ClaimStatus.sort_order, ClaimStatus.name)
    ).all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(status.id),
                    "name": status.name,
                    "slug": status.slug,
                    "sort_order": status.sort_order,
                    "is_terminal": status.is_terminal,
                }
                for status in statuses
            ]
        }
    )


@bp.post("/claims/statuses")
@login_required
def create_status():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin configura status", status=403)
    payload = StatusCreate.model_validate(request.get_json(silent=True) or {})
    existing = db.session.scalar(
        select(ClaimStatus.id).where(
            ClaimStatus.organization_id == ctx.organization_id,
            ClaimStatus.slug == payload.slug,
        )
    )
    if existing:
        raise BusinessError("duplicate_status", "Já existe status com esse código", status=409)
    status = ClaimStatus(
        organization_id=ctx.organization_id,
        **payload.model_dump(),
    )
    db.session.add(status)
    db.session.flush()
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_status",
        entity_id=str(status.id),
        action="create",
        after=payload.model_dump(),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(status.id)}), 201


@bp.patch("/claims/statuses/<status_id>")
@login_required
def update_claim_status(status_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin configura status", status=403)
    status = db.session.scalar(
        select(ClaimStatus).where(
            ClaimStatus.id == status_id,
            ClaimStatus.organization_id == ctx.organization_id,
        )
    )
    if status is None:
        raise BusinessError("not_found", "Status de sinistro não encontrado", status=404)
    payload = StatusUpdate.model_validate(request.get_json(silent=True) or {})
    before = {
        "name": status.name,
        "sort_order": status.sort_order,
        "is_terminal": status.is_terminal,
        "is_active": status.is_active,
    }
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(status, field, value)
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_status",
        entity_id=str(status.id),
        action="update",
        before=before,
        after=payload.model_dump(exclude_unset=True),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(status.id)})


@bp.get("/claims")
@login_required
def list_claims():
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    stmt = _claim_query(ctx)
    page, per_page = _paging()
    q = (request.args.get("q") or "").strip()
    status = (request.args.get("status") or "").strip()
    state = (request.args.get("state") or "").strip()
    responsible_user_id = (request.args.get("responsible_user_id") or "").strip()
    insurer = (request.args.get("insurer") or "").strip()
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Claim.insurer).like(like),
                func.lower(Claim.branch).like(like),
                func.lower(Claim.claim_number).like(like),
                func.lower(Claim.vehicle_plate).like(like),
                exists().where(
                    ClaimParty.claim_id == Claim.id,
                    func.lower(ClaimParty.name).like(like),
                ),
            )
        )
    if state == "open":
        stmt = stmt.where(Claim.status_id.not_in(_terminal_status_ids(ctx.organization_id)))
    elif state == "closed":
        stmt = stmt.where(Claim.status_id.in_(_terminal_status_ids(ctx.organization_id)))
    elif state:
        raise BusinessError("invalid_state", "Situação de sinistro inválida", status=422)
    if status:
        status_row = db.session.scalar(
            select(ClaimStatus).where(
                ClaimStatus.organization_id == ctx.organization_id,
                ClaimStatus.slug == status,
            )
        )
        if status_row:
            stmt = stmt.where(Claim.status_id == status_row.id)
        else:
            raise BusinessError("invalid_status", "Status de sinistro inválido", status=422)
    if responsible_user_id:
        stmt = stmt.where(Claim.responsible_user_id == responsible_user_id)
    if insurer:
        stmt = stmt.where(func.lower(Claim.insurer) == insurer.lower())
    total = db.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.session.scalars(
        stmt.order_by(Claim.opened_on.desc(), Claim.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()
    summaries = _summaries([str(claim.id) for claim in items])
    return jsonify(
        {
            "items": [_serialize(claim, ctx, summaries[str(claim.id)]) for claim in items],
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    )


@bp.get("/claims/dashboard")
@login_required
def claims_dashboard():
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    today = today_local()
    open_claims = _claim_query(ctx).where(
        Claim.status_id.not_in(_terminal_status_ids(ctx.organization_id))
    )
    open_count = (
        db.session.scalar(select(func.count()).select_from(open_claims.subquery())) or 0
    )
    open_claim_ids = select(open_claims.subquery().c.id)
    pending = select(ClaimTask).where(
        ClaimTask.organization_id == ctx.organization_id,
        ClaimTask.claim_id.in_(open_claim_ids),
        ClaimTask.done_at.is_(None),
        ClaimTask.due_on.is_not(None),
        ClaimTask.due_on <= today,
    )
    today_count = (
        db.session.scalar(
            select(func.count()).select_from(
                pending.where(ClaimTask.due_on == today).subquery()
            )
        )
        or 0
    )
    tasks = db.session.scalars(
        pending.order_by(ClaimTask.due_on, ClaimTask.created_at).limit(100)
    ).all()
    claims_by_id = {
        str(claim.id): claim
        for claim in db.session.scalars(
            select(Claim).where(Claim.id.in_({task.claim_id for task in tasks}))
        )
    }
    summaries = _summaries(list(claims_by_id))
    items = []
    for task in tasks:
        claim = claims_by_id[str(task.claim_id)]
        status = db.session.get(ClaimStatus, claim.status_id)
        items.append(
            {
                "task_id": str(task.id),
                "claim_id": str(claim.id),
                "title": task.title,
                "due_on": task.due_on.isoformat(),
                "priority": task.priority,
                "overdue": task.due_on < today,
                "insured_name": summaries[str(claim.id)]["insured_name"],
                "insurer": claim.insurer,
                "claim_number": claim.claim_number,
                "status_name": status.name if status else None,
            }
        )
    return jsonify(
        {
            "today": today.isoformat(),
            "open_count": open_count,
            "today_count": today_count,
            "items": items,
        }
    )


def _serialize_insurer_profile(insurer: Insurer, profile: ClaimInsurerProfile | None) -> dict:
    return {
        "insurer_id": str(insurer.id),
        "name": insurer.name,
        "contacts": profile.contacts if profile else None,
        "rental_car_contact": profile.rental_car_contact if profile else None,
        "notes": profile.notes if profile else None,
        "updated_at": profile.updated_at.isoformat() if profile else None,
    }


@bp.get("/claims/insurers")
@login_required
def list_insurer_profiles():
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    rows = db.session.execute(
        select(Insurer, ClaimInsurerProfile)
        .outerjoin(
            ClaimInsurerProfile,
            (ClaimInsurerProfile.insurer_id == Insurer.id)
            & (ClaimInsurerProfile.organization_id == ctx.organization_id),
        )
        .where(
            Insurer.organization_id == ctx.organization_id,
            Insurer.is_active.is_(True),
            Insurer.archived_at.is_(None),
        )
        .order_by(Insurer.name)
    ).all()
    return jsonify(
        {"items": [_serialize_insurer_profile(insurer, profile) for insurer, profile in rows]}
    )


@bp.put("/claims/insurers/<insurer_id>/profile")
@login_required
def save_insurer_profile(insurer_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError(
            "forbidden", "Sem permissão para editar informações da seguradora", status=403
        )
    insurer = services.get_insurer(insurer_id, ctx.organization_id)
    payload = InsurerProfileInput.model_validate(request.get_json(silent=True) or {})
    profile = db.session.scalar(
        select(ClaimInsurerProfile).where(
            ClaimInsurerProfile.organization_id == ctx.organization_id,
            ClaimInsurerProfile.insurer_id == insurer.id,
        )
    )
    before = _serialize_insurer_profile(insurer, profile)
    if profile is None:
        profile = ClaimInsurerProfile(
            organization_id=ctx.organization_id, insurer_id=insurer.id
        )
        db.session.add(profile)
    for field, value in payload.model_dump().items():
        setattr(profile, field, (value or "").strip() or None)
    profile.updated_by = ctx.user_id
    db.session.flush()
    after = _serialize_insurer_profile(insurer, profile)
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim_insurer_profile",
        entity_id=str(profile.id),
        action="update",
        before=before,
        after=after,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(after)


@bp.get("/claims/assignees")
@login_required
def list_assignees():
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para atribuir sinistros", status=403)
    now = now_utc()
    claims_managers = select(PermissionGrant.user_id).where(
        PermissionGrant.organization_id == ctx.organization_id,
        PermissionGrant.permission == "claims.manage",
        PermissionGrant.revoked_at.is_(None),
        or_(PermissionGrant.starts_at.is_(None), PermissionGrant.starts_at <= now),
        or_(PermissionGrant.ends_at.is_(None), PermissionGrant.ends_at > now),
    )
    users = db.session.scalars(
        select(User)
        .where(
            User.organization_id == ctx.organization_id,
            User.is_active.is_(True),
            User.archived_at.is_(None),
            or_(User.role == ROLE_ADMIN, User.id.in_(claims_managers)),
        )
        .order_by(User.name)
    ).all()
    return jsonify({"users": [{"id": str(user.id), "name": user.name} for user in users]})


@bp.post("/claims")
@login_required
def create_claim():
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Somente a equipe de sinistros pode cadastrar", status=403)
    payload = ClaimInput.model_validate(request.get_json(silent=True) or {})
    claim = services.create_claim(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        data=payload.model_dump(),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx)), 201


@bp.get("/claims/<claim_id>")
@login_required
def get_claim(claim_id: str):
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    return jsonify(_detail(_load_claim(claim_id, ctx), ctx))


@bp.patch("/claims/<claim_id>")
@login_required
def update_claim(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para editar sinistro", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = ClaimUpdate.model_validate(request.get_json(silent=True) or {})
    changes = payload.model_dump(exclude_unset=True)
    branch, insurer, workshop = services.resolve_claim_catalogs(
        changes, ctx.organization_id, claim
    )
    services.validate_links(changes, ctx.organization_id)
    services.validate_dates(changes, claim)
    item = services.normalize_item_fields(changes)
    before = {
        "branch": claim.branch,
        "branch_id": str(claim.branch_id),
        "insurer": claim.insurer,
        "insurer_id": str(claim.insurer_id),
        "opened_on": claim.opened_on.isoformat(),
        "lead_id": str(claim.lead_id) if claim.lead_id else None,
        "opportunity_id": str(claim.opportunity_id) if claim.opportunity_id else None,
        "sale_id": str(claim.sale_id) if claim.sale_id else None,
        "claim_number": claim.claim_number,
        "service_type": claim.service_type,
        "has_third_party": claim.has_third_party,
        "vehicle_plate": claim.vehicle_plate,
        "vehicle_model": claim.vehicle_model,
        "vehicle_year": claim.vehicle_year,
        "property_address": claim.property_address,
        "coverage": claim.coverage,
        "concluded_on": claim.concluded_on.isoformat() if claim.concluded_on else None,
        "closed_on": claim.closed_on.isoformat() if claim.closed_on else None,
        "indemnified_on": claim.indemnified_on.isoformat() if claim.indemnified_on else None,
        "indemnified_amount": str(claim.indemnified_amount) if claim.indemnified_amount is not None else None,
        "workshop": claim.workshop,
        "workshop_id": str(claim.workshop_id) if claim.workshop_id else None,
        "notes": claim.notes,
    }
    for field, value in {**changes, **item}.items():
        if field in {"branch_id", "insurer_id", "workshop_id"}:
            continue
        setattr(claim, field, value)
    if "service_type" in changes:
        claim.has_third_party = services.has_third_party_service(
            claim.service_type
        ) or bool(
            db.session.scalar(
                select(ClaimParty.id).where(
                    ClaimParty.claim_id == claim.id,
                    ClaimParty.role == services.PARTY_THIRD,
                )
            )
        )
    claim.branch_id = branch.id
    claim.branch = branch.name
    claim.insurer_id = insurer.id
    claim.insurer = insurer.name
    claim.workshop_id = workshop.id if workshop else None
    claim.workshop = workshop.name if workshop else None
    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="claim",
        entity_id=str(claim.id),
        action="update",
        before=before,
        after=payload.model_dump(mode="json", exclude_unset=True),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.post("/claims/<claim_id>/assign")
@login_required
def assign_claim(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para atribuir sinistro", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = AssignmentInput.model_validate(request.get_json(silent=True) or {})
    services.assign_claim(
        claim=claim,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        responsible_user_id=payload.responsible_user_id,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.post("/claims/<claim_id>/status")
@login_required
def update_status(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para alterar status", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = StatusInput.model_validate(request.get_json(silent=True) or {})
    status = services.get_status(payload.status_id, ctx.organization_id)
    services.change_status(
        claim=claim,
        status=status,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.get("/claims/<claim_id>/events")
@login_required
def list_events(claim_id: str):
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    claim = _load_claim(claim_id, ctx)
    return jsonify({"items": _detail(claim, ctx)["events"]})


@bp.post("/claims/<claim_id>/events")
@login_required
def create_event(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para registrar acompanhamento", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = EventInput.model_validate(request.get_json(silent=True) or {})
    services.add_event(
        claim=claim,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        event_type="note",
        description=payload.description,
        request_id=getattr(g, "request_id", None),
        occurred_at=payload.occurred_at,
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.patch("/claims/<claim_id>/events/<event_id>")
@login_required
def update_event_date(claim_id: str, event_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para ajustar o histórico", status=403)
    claim = _load_claim(claim_id, ctx)
    event = db.session.scalar(
        select(ClaimEvent).where(
            ClaimEvent.id == event_id,
            ClaimEvent.claim_id == claim.id,
            ClaimEvent.organization_id == ctx.organization_id,
        )
    )
    if event is None:
        raise BusinessError("not_found", "Atualização não encontrada", status=404)
    payload = EventDateInput.model_validate(request.get_json(silent=True) or {})
    services.change_event_time(
        claim=claim,
        event=event,
        occurred_at=payload.occurred_at,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.post("/claims/<claim_id>/parties")
@login_required
def create_party(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para incluir participante", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = PartyInput.model_validate(request.get_json(silent=True) or {})
    party = services.add_party(
        claim=claim,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        data=payload.model_dump(),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(party.id)}), 201


@bp.get("/claims/<claim_id>/tasks")
@login_required
def list_tasks(claim_id: str):
    ctx = load_context()
    if not _can_read(ctx):
        raise BusinessError("forbidden", "Sem acesso a sinistros", status=403)
    claim = _load_claim(claim_id, ctx)
    return jsonify({"items": _detail(claim, ctx)["tasks"]})


@bp.post("/claims/<claim_id>/tasks")
@login_required
def create_task(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para criar tarefas", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = TaskInput.model_validate(request.get_json(silent=True) or {})
    task = services.add_task(
        claim=claim,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        data=payload.model_dump(),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(task.id), "title": task.title}), 201


@bp.patch("/claims/<claim_id>/tasks/<task_id>")
@login_required
def update_task(claim_id: str, task_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para atualizar tarefa", status=403)
    claim = _load_claim(claim_id, ctx)
    task = db.session.scalar(
        select(ClaimTask).where(
            ClaimTask.id == task_id,
            ClaimTask.claim_id == claim.id,
            ClaimTask.organization_id == ctx.organization_id,
        )
    )
    if task is None:
        raise BusinessError("not_found", "Tarefa não encontrada", status=404)
    payload = TaskUpdate.model_validate(request.get_json(silent=True) or {})
    services.set_task_completion(
        claim=claim,
        task=task,
        done=payload.done,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_detail(claim, ctx))


@bp.post("/claims/<claim_id>/archive")
@login_required
def archive_claim(claim_id: str):
    ctx = load_context()
    if not _can_manage(ctx):
        raise BusinessError("forbidden", "Sem permissão para arquivar sinistro", status=403)
    claim = _load_claim(claim_id, ctx)
    payload = ArchiveInput.model_validate(request.get_json(silent=True) or {})
    services.archive_claim(
        claim=claim,
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        reason=payload.reason,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return ("", 204)
