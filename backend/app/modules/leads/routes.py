from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from sqlalchemy import func, select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..catalog.models import Origin
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR, Product, Team, User
from . import services
from .models import DELETION_PENDING, Availability, Lead, LeadDeletionRequest, LeadPhone
from .schemas import (
    AvailabilityCreate,
    AvailabilityOut,
    LeadCreate,
    LeadListItem,
    LeadListResponse,
    LeadOut,
    LeadPhoneOut,
    LeadUpdate,
)

bp = Blueprint("leads", __name__)


def _paging() -> tuple[int, int]:
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        per_page = min(200, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        per_page = 25
    return page, per_page


@bp.get("/leads")
@login_required
def list_leads():
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Perfil sem acesso a leads", status=403)

    page, per_page = _paging()
    q = (request.args.get("q") or "").strip()
    show_archived = request.args.get("archived", "false").lower() == "true"

    stmt = select(Lead).where(Lead.organization_id == ctx.organization_id)
    if not show_archived:
        stmt = stmt.where(Lead.archived_at.is_(None))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Lead.name).like(like))

    total = db.session.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()
    stmt = stmt.order_by(Lead.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

    leads = db.session.execute(stmt).scalars().all()
    lead_ids = [lead.id for lead in leads]
    phones_by_lead: dict[str, list[LeadPhone]] = {}
    released: set[str] = set()
    if lead_ids:
        rows = db.session.execute(
            select(LeadPhone).where(LeadPhone.lead_id.in_(lead_ids))
        ).scalars().all()
        for p in rows:
            phones_by_lead.setdefault(p.lead_id, []).append(p)
        released = set(
            db.session.execute(
                select(Availability.lead_id).where(
                    Availability.organization_id == ctx.organization_id,
                    Availability.lead_id.in_(lead_ids),
                    Availability.archived_at.is_(None),
                )
            ).scalars()
        )

    items = [
        LeadListItem(
            id=str(lead.id),
            name=lead.name,
            kind=lead.kind,
            city=lead.city,
            state=lead.state,
            phones=[p.phone_e164 for p in phones_by_lead.get(lead.id, [])],
            archived=lead.archived_at is not None,
            released=lead.id in released,
        )
        for lead in leads
    ]
    return jsonify(
        LeadListResponse(items=items, page=page, per_page=per_page, total=total).model_dump()
    )


@bp.post("/leads")
@login_required
def create_lead():
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Somente admin/SDR criam leads", status=403)

    payload = LeadCreate.model_validate(request.get_json(silent=True) or {})
    lead = services.create_lead(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        data=services.LeadInput(
            name=payload.name,
            kind=payload.kind,
            phones=payload.phones,
            document=payload.document,
            city=payload.city,
            state=payload.state,
            postal_code=payload.postal_code,
            indicator_name=payload.indicator_name,
            notes=payload.notes,
            origin_id=payload.origin_id,
            client_type_id=payload.client_type_id,
            vehicles=[v.model_dump() for v in payload.vehicles],
        ),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_full_response(lead.id)), 201


@bp.get("/leads/<lead_id>")
@login_required
def get_lead(lead_id: str):
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Perfil sem acesso a leads", status=403)
    lead = _load_org_lead(lead_id, ctx.organization_id)
    return jsonify(_full_response(lead.id))


@bp.patch("/leads/<lead_id>")
@login_required
def update_lead(lead_id: str):
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Sem permissão para editar", status=403)
    lead = _load_org_lead(lead_id, ctx.organization_id)
    payload = LeadUpdate.model_validate(request.get_json(silent=True) or {})
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and not (changes["name"] or "").strip():
        raise BusinessError("invalid_name", "Nome é obrigatório", status=422)
    if "kind" in changes and changes["kind"] is None:
        raise BusinessError("invalid_kind", "Tipo de pessoa inválido", status=422)
    for field, value in (
        ("origin_id", changes.get("origin_id")),
        ("client_type_id", changes.get("client_type_id")),
    ):
        if value:
            _ensure_catalog_item(field, value, ctx.organization_id)
    before = _audit_snapshot(lead)
    phones = changes.pop("phones", None)
    if phones is not None:
        services.replace_phones(
            organization_id=ctx.organization_id, lead=lead, raws=phones
        )
    if "postal_code" in changes:
        changes["postal_code"] = services.normalize_postal_code(changes["postal_code"])
    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip() or None
            if field == "state" and value:
                value = value.upper()
        setattr(lead, field, value)
    db.session.flush()

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="lead",
        entity_id=str(lead.id),
        action="update",
        before=before,
        after=_audit_snapshot(lead),
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify(_full_response(lead.id))


@bp.post("/leads/<lead_id>/archive")
@login_required
def archive_lead(lead_id: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN and "leads.archive" not in ctx.grants:
        raise BusinessError("forbidden", "Sem permissão para arquivar", status=403)
    lead = _load_org_lead(lead_id, ctx.organization_id)
    reason = (request.get_json(silent=True) or {}).get("reason")
    services.archive_lead(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        lead=lead,
        reason=reason,
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return ("", 204)


@bp.post("/leads/<lead_id>/deletion-request")
@login_required
def request_lead_deletion(lead_id: str):
    """SDR/admin excluem um lead; o administrador avalia a exclusão depois."""
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Somente admin/SDR excluem leads", status=403)
    lead = _load_org_lead(lead_id, ctx.organization_id)
    body = request.get_json(silent=True) or {}
    deletion = services.request_deletion(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        lead=lead,
        reason=(body.get("reason") or "")[:500] or None,
        import_batch_id=_imported_batch_id(lead.id, ctx.organization_id),
        request_id=getattr(g, "request_id", None),
    )
    from ..notifications.services import notify_admins

    notify_admins(
        organization_id=ctx.organization_id,
        kind="lead_deletion_requested",
        title=f"Exclusão de lead para avaliar: {lead.name}",
        entity_type="lead",
        entity_id=str(lead.id),
        link_path="/admin/importacoes",
        dedup_key=f"lead_deletion:{deletion.id}",
    )
    db.session.commit()
    return jsonify({"id": str(deletion.id), "status": deletion.status}), 201


@bp.get("/lead-deletion-requests")
@login_required
def list_deletion_requests():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin avalia exclusões", status=403)
    status = request.args.get("status", DELETION_PENDING)
    rows = db.session.execute(
        select(LeadDeletionRequest, Lead, User)
        .join(Lead, Lead.id == LeadDeletionRequest.lead_id)
        .join(User, User.id == LeadDeletionRequest.requested_by)
        .where(
            LeadDeletionRequest.organization_id == ctx.organization_id,
            LeadDeletionRequest.status == status,
        )
        .order_by(LeadDeletionRequest.created_at.desc())
        .limit(200)
    ).all()
    lead_ids = [lead.id for _, lead, _ in rows]
    phones: dict[str, list[str]] = {}
    if lead_ids:
        for phone in db.session.execute(
            select(LeadPhone).where(LeadPhone.lead_id.in_(lead_ids))
        ).scalars():
            phones.setdefault(phone.lead_id, []).append(phone.phone_e164)
    return jsonify(
        {
            "items": [
                {
                    "id": str(deletion.id),
                    "lead_id": str(lead.id),
                    "lead_name": lead.name,
                    "phones": phones.get(lead.id, []),
                    "import_batch_id": str(deletion.import_batch_id)
                    if deletion.import_batch_id
                    else None,
                    "requested_by_name": requester.name,
                    "reason": deletion.reason,
                    "status": deletion.status,
                    "created_at": deletion.created_at.isoformat(),
                }
                for deletion, lead, requester in rows
            ]
        }
    )


@bp.post("/lead-deletion-requests/<request_id>/<decision>")
@login_required
def review_deletion_request(request_id: str, decision: str):
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente admin avalia exclusões", status=403)
    if decision not in ("approve", "reject"):
        raise BusinessError("not_found", "Ação inválida", status=404)
    deletion = db.session.get(LeadDeletionRequest, request_id)
    if deletion is None or deletion.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Solicitação não encontrada", status=404)
    services.review_deletion(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        deletion=deletion,
        approve=decision == "approve",
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(deletion.id), "status": deletion.status})


# ---- Availabilities ----------------------------------------------------------

@bp.post("/availabilities")
@login_required
def release_lead():
    """SDR/admin disponibiliza o lead para um produto (RN — Prospecção 4.1)."""
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Somente admin/SDR disponibilizam leads", status=403)

    payload = AvailabilityCreate.model_validate(request.get_json(silent=True) or {})
    lead = _load_org_lead(payload.lead_id, ctx.organization_id)
    if lead.archived_at is not None:
        raise BusinessError("archived_lead", "Lead arquivado", status=409)
    for value, model, label in (
        (payload.product_id, Product, "Produto"),
        (payload.team_id, Team, "Equipe"),
        (payload.origin_id, Origin, "Origem"),
    ):
        if value and not db.session.scalar(
            select(model.id).where(
                model.id == value,
                model.organization_id == ctx.organization_id,
            )
        ):
            raise BusinessError("not_found", f"{label} não encontrado", status=404)

    existing_open = db.session.execute(
        select(Availability).where(
            Availability.organization_id == ctx.organization_id,
            Availability.lead_id == lead.id,
            Availability.product_id == payload.product_id,
            Availability.claimed_at.is_(None),
            Availability.archived_at.is_(None),
        )
    ).scalar_one_or_none()
    if existing_open is not None:
        return jsonify({"id": str(existing_open.id), "already_open": True}), 200

    avail = Availability(
        organization_id=ctx.organization_id,
        lead_id=lead.id,
        product_id=payload.product_id,
        team_id=payload.team_id,
        origin_id=payload.origin_id,
        released_by=ctx.user_id,
        released_at=now_utc(),
    )
    db.session.add(avail)
    db.session.flush()

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="availability",
        entity_id=str(avail.id),
        action="release",
        after={"lead_id": str(lead.id), "product_id": payload.product_id},
        request_id=getattr(g, "request_id", None),
    )
    # RN-081: notifica admins
    from ..notifications.services import notify_admins

    notify_admins(
        organization_id=ctx.organization_id,
        kind="lead_released",
        title=f"Lead disponibilizado: {lead.name}",
        body=None,
        entity_type="lead",
        entity_id=str(lead.id),
        link_path="/admin/prospeccao",
        dedup_key=f"availability:{avail.id}",
    )
    db.session.commit()
    return jsonify({"id": str(avail.id), "already_open": False}), 201


@bp.get("/availabilities")
@login_required
def list_availabilities():
    """Vendedor lista leads disponíveis dos produtos autorizados (MP-001)."""
    ctx = load_context()
    if ctx.role == ROLE_SDR:
        raise BusinessError("forbidden", "SDR não trabalha oportunidades", status=403)

    page, per_page = _paging()
    stmt = (
        select(Availability, Lead)
        .join(Lead, Lead.id == Availability.lead_id)
        .where(
            Availability.organization_id == ctx.organization_id,
            Availability.claimed_at.is_(None),
            Availability.archived_at.is_(None),
            Lead.archived_at.is_(None),
        )
    )
    if ctx.role == ROLE_VENDEDOR:
        if not ctx.product_ids:
            return jsonify({"items": [], "page": page, "per_page": per_page, "total": 0})
        stmt = stmt.where(Availability.product_id.in_(ctx.product_ids))

    total = db.session.execute(
        select(func.count()).select_from(stmt.subquery())
    ).scalar_one()
    stmt = stmt.order_by(Availability.released_at.desc()).offset((page - 1) * per_page).limit(per_page)
    rows = db.session.execute(stmt).all()

    lead_ids = [lead.id for _, lead in rows]
    phones_by_lead: dict[str, list[str]] = {}
    if lead_ids:
        for p in db.session.execute(
            select(LeadPhone).where(LeadPhone.lead_id.in_(lead_ids))
        ).scalars().all():
            phones_by_lead.setdefault(p.lead_id, []).append(p.phone_e164)

    items = [
        AvailabilityOut(
            id=str(avail.id),
            lead_id=str(lead.id),
            product_id=str(avail.product_id),
            lead_name=lead.name,
            lead_city=lead.city,
            lead_state=lead.state,
            phones=phones_by_lead.get(lead.id, []),
            origin_id=str(avail.origin_id) if avail.origin_id else None,
            released_at=avail.released_at,
            claimed_by=str(avail.claimed_by) if avail.claimed_by else None,
        ).model_dump()
        for avail, lead in rows
    ]
    return jsonify({"items": items, "page": page, "per_page": per_page, "total": total})


# ---- Helpers ----------------------------------------------------------------

def _ensure_catalog_item(field: str, value: str, organization_id: str) -> None:
    from ..catalog.models import ClientType

    model = Origin if field == "origin_id" else ClientType
    if not db.session.scalar(
        select(model.id).where(model.id == value, model.organization_id == organization_id)
    ):
        raise BusinessError("not_found", "Configuração não encontrada", status=404)


def _audit_snapshot(lead: Lead) -> dict:
    return {
        "name": lead.name,
        "kind": lead.kind,
        "document": lead.document,
        "city": lead.city,
        "state": lead.state,
        "postal_code": lead.postal_code,
        "phones": sorted(
            db.session.execute(
                select(LeadPhone.phone_e164).where(LeadPhone.lead_id == lead.id)
            ).scalars()
        ),
    }


def _imported_batch_id(lead_id: str, organization_id: str) -> str | None:
    from ..imports.models import ImportRow

    batch_id = db.session.scalar(
        select(ImportRow.batch_id).where(
            ImportRow.organization_id == organization_id,
            ImportRow.lead_id == lead_id,
        )
    )
    return str(batch_id) if batch_id else None


def _load_org_lead(lead_id: str, organization_id: str) -> Lead:
    lead = db.session.get(Lead, lead_id)
    if lead is None or lead.organization_id != organization_id:
        raise BusinessError("not_found", "Lead não encontrado", status=404)
    return lead


def _full_response(lead_id: str) -> dict:
    lead = db.session.get(Lead, lead_id)
    phones = db.session.execute(
        select(LeadPhone).where(LeadPhone.lead_id == lead.id).order_by(LeadPhone.is_primary.desc())
    ).scalars().all()
    return LeadOut(
        id=str(lead.id),
        kind=lead.kind,
        name=lead.name,
        document=lead.document,
        city=lead.city,
        state=lead.state,
        postal_code=lead.postal_code,
        indicator_name=lead.indicator_name,
        notes=lead.notes,
        origin_id=str(lead.origin_id) if lead.origin_id else None,
        client_type_id=str(lead.client_type_id) if lead.client_type_id else None,
        archived_at=lead.archived_at,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        phones=[
            LeadPhoneOut(phone_e164=p.phone_e164, original=p.original, is_primary=p.is_primary)
            for p in phones
        ],
    ).model_dump()
