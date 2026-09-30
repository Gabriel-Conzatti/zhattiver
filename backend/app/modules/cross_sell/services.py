from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, or_, select

from ...core.audit import record as audit_record
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..leads.models import Availability, Lead, LeadProduct, STATUS_HAS, STATUS_NONE
from ..notifications.services import notify
from ..opportunities.models import Activity
from .models import (
    ITEM_STATE_PENDING,
    ITEM_STATE_RELEASED,
    LIST_STATE_DRAFT,
    LIST_STATE_PARTIAL,
    LIST_STATE_RELEASED,
    CrossSellItem,
    CrossSellList,
)


def _last_contact_map(organization_id: str, lead_ids: list[str]) -> dict[str, datetime]:
    if not lead_ids:
        return {}
    from sqlalchemy import func

    rows = db.session.execute(
        select(Activity.lead_id, func.max(Activity.occurred_at))
        .where(
            Activity.organization_id == organization_id,
            Activity.lead_id.in_(lead_ids),
        )
        .group_by(Activity.lead_id)
    ).all()
    return {r[0]: r[1] for r in rows}


def generate_list(
    *,
    organization_id: str,
    actor_user_id: str,
    name: str,
    target_product_id: str,
    has_product_ids: list[str] | None = None,
    lacks_product_ids: list[str] | None = None,
    include_unknown: bool = False,
    request_id: str | None = None,
) -> CrossSellList:
    """RN-060..063: gera pré-lista administrativa por filtros.

    - `has_product_ids`: leads que possuem *pelo menos um* desses produtos (`status='has'`).
    - `lacks_product_ids`: leads que não possuem esses produtos. Se `include_unknown=False`,
      apenas `status='none'` conta; se True, `status='unknown'` (ou ausência de registro) também
      é considerado.
    """
    csl = CrossSellList(
        organization_id=organization_id,
        name=name.strip()[:200],
        target_product_id=target_product_id,
        filters={
            "has_product_ids": has_product_ids or [],
            "lacks_product_ids": lacks_product_ids or [],
            "include_unknown": include_unknown,
        },
        state=LIST_STATE_DRAFT,
        created_by=actor_user_id,
    )
    db.session.add(csl)
    db.session.flush()

    stmt = select(Lead).where(
        Lead.organization_id == organization_id,
        Lead.archived_at.is_(None),
    )
    if has_product_ids:
        stmt = stmt.where(
            Lead.id.in_(
                select(LeadProduct.lead_id).where(
                    LeadProduct.organization_id == organization_id,
                    LeadProduct.product_id.in_(has_product_ids),
                    LeadProduct.status == STATUS_HAS,
                )
            )
        )
    if lacks_product_ids:
        # Sub-consulta: leads que possuem `has` de qualquer produto restrito.
        blocked = select(LeadProduct.lead_id).where(
            LeadProduct.organization_id == organization_id,
            LeadProduct.product_id.in_(lacks_product_ids),
            LeadProduct.status == STATUS_HAS,
        )
        stmt = stmt.where(~Lead.id.in_(blocked))
        if not include_unknown:
            # exige `status='none'` explícito em pelo menos um dos produtos alvo restritos
            with_none = select(LeadProduct.lead_id).where(
                LeadProduct.organization_id == organization_id,
                LeadProduct.product_id.in_(lacks_product_ids),
                LeadProduct.status == STATUS_NONE,
            )
            stmt = stmt.where(Lead.id.in_(with_none))

    leads = db.session.execute(stmt).scalars().all()
    lead_ids = [l.id for l in leads]
    last_contact = _last_contact_map(organization_id, lead_ids)
    for lead in leads:
        db.session.add(
            CrossSellItem(
                organization_id=organization_id,
                list_id=csl.id,
                lead_id=lead.id,
                state=ITEM_STATE_PENDING,
                last_contact_at=last_contact.get(lead.id),
            )
        )
    csl.total_items = len(leads)
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="cross_sell_list",
        entity_id=str(csl.id),
        action="create",
        after={
            "name": csl.name,
            "target_product_id": target_product_id,
            "total_items": csl.total_items,
        },
        request_id=request_id,
    )
    notify(
        organization_id=organization_id,
        user_id=actor_user_id,
        kind="cross_sell_list",
        title=f"Pré-lista {csl.name} gerada",
        body=f"{csl.total_items} clientes candidatos.",
        entity_type="cross_sell_list",
        entity_id=str(csl.id),
        link_path="/admin/cross-sell",
        dedup_key=f"cross_sell_list:{csl.id}",
    )
    return csl


def release_items(
    *,
    organization_id: str,
    actor_user_id: str,
    csl: CrossSellList,
    item_ids: list[str] | None = None,
    request_id: str | None = None,
) -> int:
    """RN-063: libera itens (todos ou selecionados) criando Availabilities para o produto alvo."""
    if csl.state == LIST_STATE_RELEASED:
        raise BusinessError("already_released", "Lista já liberada", status=409)

    stmt = select(CrossSellItem).where(
        CrossSellItem.list_id == csl.id,
        CrossSellItem.state == ITEM_STATE_PENDING,
    )
    if item_ids:
        stmt = stmt.where(CrossSellItem.id.in_(item_ids))
    items = db.session.execute(stmt).scalars().all()
    released = 0
    now = now_utc()
    for item in items:
        existing = db.session.execute(
            select(Availability).where(
                Availability.organization_id == organization_id,
                Availability.lead_id == item.lead_id,
                Availability.product_id == csl.target_product_id,
                Availability.claimed_at.is_(None),
                Availability.archived_at.is_(None),
            )
        ).scalar_one_or_none()
        if existing is None:
            avail = Availability(
                organization_id=organization_id,
                lead_id=item.lead_id,
                product_id=csl.target_product_id,
                released_by=actor_user_id,
                released_at=now,
            )
            db.session.add(avail)
            db.session.flush()
            item.availability_id = avail.id
        else:
            item.availability_id = existing.id
        item.state = ITEM_STATE_RELEASED
        item.released_at = now
        released += 1

    csl.released_items = (csl.released_items or 0) + released
    csl.state = LIST_STATE_RELEASED if csl.released_items >= csl.total_items else LIST_STATE_PARTIAL

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="cross_sell_list",
        entity_id=str(csl.id),
        action="release",
        after={"released": released, "state": csl.state},
        request_id=request_id,
    )
    return released
