from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from sqlalchemy import func, select

from ...core.authz import load_context
from ...core.errors import BusinessError, api_error
from ...core.time import now_utc
from ...extensions import db
from ..users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR
from . import services
from .models import Availability, Lead, LeadPhone
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


def _serialize_list_item(lead: Lead) -> LeadListItem:
    return LeadListItem(
        id=str(lead.id),
        name=lead.name,
        kind=lead.kind,
        city=lead.city,
        state=lead.state,
        phones=[p.phone_e164 for p in lead.phones],
        archived=lead.archived_at is not None,
    )


def _serialize_full(lead: Lead) -> LeadOut:
    return LeadOut(
        id=str(lead.id),
        kind=lead.kind,
        name=lead.name,
        document=lead.document,
        city=lead.city,
        state=lead.state,
        indicator_name=lead.indicator_name,
        notes=lead.notes,
        origin_id=str(lead.origin_id) if lead.origin_id else None,
        client_type_id=str(lead.client_type_id) if lead.client_type_id else None,
        archived_at=lead.archived_at,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        phones=[
            LeadPhoneOut(
                phone_e164=p.phone_e164, original=p.original, is_primary=p.is_primary
            )
            for p in sorted(lead.phones, key=lambda x: not x.is_primary)
        ],
    )


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
    lead_ids = [l.id for l in leads]
    phones_by_lead: dict[str, list[LeadPhone]] = {}
    if lead_ids:
        rows = db.session.execute(
            select(LeadPhone).where(LeadPhone.lead_id.in_(lead_ids))
        ).scalars().all()
        for p in rows:
            phones_by_lead.setdefault(p.lead_id, []).append(p)

    items = [
        LeadListItem(
            id=str(l.id),
            name=l.name,
            kind=l.kind,
            city=l.city,
            state=l.state,
            phones=[p.phone_e164 for p in phones_by_lead.get(l.id, [])],
            archived=l.archived_at is not None,
        )
        for l in leads
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
    before = {
        "name": lead.name,
        "city": lead.city,
        "state": lead.state,
        "kind": lead.kind,
    }
    for field, value in payload.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip() or None
            if field == "state" and value:
                value = value.upper()
        setattr(lead, field, value)
    from ...core.audit import record

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="lead",
        entity_id=str(lead.id),
        action="update",
        before=before,
        after={
            "name": lead.name,
            "city": lead.city,
            "state": lead.state,
            "kind": lead.kind,
        },
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
    from ...core.audit import record

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="availability",
        entity_id=None,
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
