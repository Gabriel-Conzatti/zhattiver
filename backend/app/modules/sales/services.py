from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.calendar import next_business_day
from ...core.errors import BusinessError
from ...core.time import DEFAULT_TZ, end_of_day_utc, now_utc, to_local
from ...extensions import db
from ..leads.models import Lead
from ..opportunities.models import STATE_OPEN, Opportunity
from ..opportunities import services as opp_services
from ..users.models import Product
from .models import (
    CANCEL_AFTER_BONUS,
    CANCEL_BEFORE_BONUS,
    STATE_CANCELLED,
    STATE_REGISTERED,
    STATE_REVISION_PENDING,
    STATE_VALIDATED,
    Sale,
    SaleRevision,
)


@dataclass
class SaleInput:
    lead_id: str
    product_id: str
    seller_user_id: str
    insurer_id: str
    client_type_id: str
    net_premium: Decimal
    commission_pct: Decimal
    closed_on: date
    opportunity_id: str | None = None
    origin: str | None = None
    notes: str | None = None


def calc_commission(net_premium: Decimal, commission_pct: Decimal) -> Decimal:
    """RN-033: commission = net_premium × commission_pct (2 casas, HALF_UP)."""
    return (net_premium * commission_pct).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def compute_edit_deadline(registered_at_utc: datetime, organization_id: str | None = None) -> datetime:
    """RN-034: até 23h59:59.999999 do próximo dia útil após o registro (fuso local)."""
    local_day = to_local(registered_at_utc, DEFAULT_TZ).date()
    deadline_day = next_business_day(local_day, organization_id)
    return end_of_day_utc(deadline_day, DEFAULT_TZ)


def create_sale(
    *,
    organization_id: str,
    actor_user_id: str,
    data: SaleInput,
    request_id: str | None = None,
) -> Sale:
    if data.net_premium is None or data.net_premium <= 0:
        raise BusinessError("invalid_net_premium", "Prêmio líquido deve ser > 0", status=422)
    if data.commission_pct is None or data.commission_pct <= 0 or data.commission_pct > 1:
        raise BusinessError(
            "invalid_commission_pct",
            "Percentual de comissão deve estar entre 0 e 1 (ex.: 0.15 = 15%)",
            status=422,
        )
    if data.closed_on is None:
        raise BusinessError("missing_closed_on", "Data de fechamento é obrigatória", status=422)

    lead = db.session.get(Lead, data.lead_id)
    if lead is None or lead.organization_id != organization_id:
        raise BusinessError("not_found", "Lead não encontrado", status=404)
    product = db.session.get(Product, data.product_id)
    if product is None or product.organization_id != organization_id:
        raise BusinessError("not_found", "Produto não encontrado", status=404)

    opportunity = None
    if data.opportunity_id:
        opportunity = db.session.get(Opportunity, data.opportunity_id)
        if opportunity is None or opportunity.organization_id != organization_id:
            raise BusinessError("not_found", "Oportunidade não encontrada", status=404)
        if opportunity.state != STATE_OPEN:
            raise BusinessError("invalid_state", "Oportunidade já encerrada", status=409)
        if opportunity.lead_id != data.lead_id or opportunity.product_id != data.product_id:
            raise BusinessError(
                "mismatch", "Oportunidade não corresponde ao lead/produto", status=422
            )

    now = now_utc()
    commission_amount = calc_commission(data.net_premium, data.commission_pct)
    sale = Sale(
        organization_id=organization_id,
        lead_id=data.lead_id,
        opportunity_id=opportunity.id if opportunity else None,
        product_id=data.product_id,
        seller_user_id=data.seller_user_id,
        insurer_id=data.insurer_id,
        client_type_id=data.client_type_id,
        net_premium=data.net_premium,
        commission_pct=data.commission_pct,
        commission_amount=commission_amount,
        closed_on=data.closed_on,
        origin=(data.origin or ("funnel" if opportunity else "direct"))[:40],
        notes=data.notes,
        registered_at=now,
        edit_deadline_at=compute_edit_deadline(now, organization_id),
        state=STATE_REGISTERED,
    )
    db.session.add(sale)
    db.session.flush()

    if opportunity is not None:
        # RN-030: registrar como ganha e criar venda ocorre na mesma transação.
        opp_services.win_opportunity(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            opportunity=opportunity,
            request_id=request_id,
        )

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="sale",
        entity_id=str(sale.id),
        action="create",
        after={
            "net_premium": str(sale.net_premium),
            "commission_pct": str(sale.commission_pct),
            "commission_amount": str(sale.commission_amount),
            "closed_on": sale.closed_on.isoformat(),
            "opportunity_id": str(opportunity.id) if opportunity else None,
        },
        request_id=request_id,
    )
    # RN-082: admins são avisados sobre venda aguardando validação.
    from ..notifications.services import notify_admins

    notify_admins(
        organization_id=organization_id,
        kind="sale_pending",
        title="Nova venda aguardando validação",
        body=f"Vendedor {data.seller_user_id[:8]} — fechada em {sale.closed_on.isoformat()}",
        entity_type="sale",
        entity_id=str(sale.id),
        link_path="/admin/producao",
        dedup_key=f"sale_pending:{sale.id}",
    )
    return sale


_MUTABLE_FIELDS = {
    "insurer_id",
    "client_type_id",
    "net_premium",
    "commission_pct",
    "closed_on",
    "notes",
}


def edit_sale(
    *,
    organization_id: str,
    actor_user_id: str,
    actor_role: str,
    actor_grants: frozenset[str],
    sale: Sale,
    changes: dict[str, Any],
    request_id: str | None = None,
) -> Sale | SaleRevision:
    """RN-034/035:

    - Vendedor edita a própria venda até `edit_deadline_at` OU com `sales.edit_after_deadline`.
    - Se a venda já foi validada e a edição parte do vendedor dentro do prazo, cria uma
      **revisão pendente** (decisão provisória): a versão validada continua oficial até
      nova aprovação.
    - Admin edita direto (sem revisão), invalidando eventual estado validado até nova validação.
    """
    if sale.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if sale.state == STATE_CANCELLED:
        raise BusinessError("invalid_state", "Venda cancelada", status=409)

    changes = {k: v for k, v in changes.items() if k in _MUTABLE_FIELDS}
    if not changes:
        return sale

    is_admin = actor_role == "admin"
    is_owner = sale.seller_user_id == actor_user_id
    now = now_utc()

    if not is_admin:
        if not is_owner:
            raise BusinessError("forbidden", "Somente o vendedor da venda pode editar", status=403)
        past_deadline = now > sale.edit_deadline_at
        if past_deadline and "sales.edit_after_deadline" not in actor_grants:
            raise BusinessError(
                "past_edit_deadline",
                "Prazo de edição expirou. Peça permissão administrativa.",
                status=409,
            )

    if not is_admin and sale.state == STATE_VALIDATED:
        # Venda validada: cria revisão pendente (RN-034 decisão provisória).
        revision = SaleRevision(
            organization_id=organization_id,
            sale_id=sale.id,
            submitted_by=actor_user_id,
            submitted_at=now,
            payload={k: _serialize(v) for k, v in changes.items()},
        )
        db.session.add(revision)
        sale.state = STATE_REVISION_PENDING
        audit_record(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            entity_type="sale",
            entity_id=str(sale.id),
            action="revision_submitted",
            after={"changes": {k: _serialize(v) for k, v in changes.items()}},
            request_id=request_id,
        )
        return revision

    before = {k: getattr(sale, k) for k in changes}
    for field, value in changes.items():
        setattr(sale, field, value)
    if "net_premium" in changes or "commission_pct" in changes:
        sale.commission_amount = calc_commission(sale.net_premium, sale.commission_pct)
    if sale.state == STATE_VALIDATED:
        # Alteração administrativa invalida até nova aprovação.
        sale.state = STATE_REGISTERED
        sale.validated_at = None
        sale.validated_by = None

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="sale",
        entity_id=str(sale.id),
        action="edit",
        before={k: _serialize(v) for k, v in before.items()},
        after={k: _serialize(getattr(sale, k)) for k in changes},
        request_id=request_id,
    )
    return sale


def validate_sale(
    *,
    organization_id: str,
    actor_user_id: str,
    sale: Sale,
    request_id: str | None = None,
) -> Sale:
    """RN-036/037: validação administrativa. Vendas validadas compõem produção oficial."""
    if sale.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if sale.state == STATE_CANCELLED:
        raise BusinessError("invalid_state", "Venda cancelada", status=409)
    if sale.state == STATE_VALIDATED:
        return sale
    if sale.state == STATE_REVISION_PENDING:
        pending = db.session.execute(
            select(SaleRevision)
            .where(SaleRevision.sale_id == sale.id, SaleRevision.state == "pending")
            .order_by(SaleRevision.submitted_at.asc())
        ).scalars().all()
        for rev in pending:
            for field, value in rev.payload.items():
                setattr(sale, field, _restore(field, value))
            rev.state = "approved"
            rev.reviewed_by = actor_user_id
            rev.reviewed_at = now_utc()
        sale.commission_amount = calc_commission(sale.net_premium, sale.commission_pct)

    sale.state = STATE_VALIDATED
    sale.validated_at = now_utc()
    sale.validated_by = actor_user_id
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="sale",
        entity_id=str(sale.id),
        action="validate",
        request_id=request_id,
    )
    return sale


def cancel_sale(
    *,
    organization_id: str,
    actor_user_id: str,
    sale: Sale,
    reason: str,
    bonus_already_paid: bool,
    request_id: str | None = None,
) -> Sale:
    """RN-040/041: cancelamento antes vs. depois do pagamento do bônus.

    Em ambos os casos a venda é preservada no histórico (RN-042). A diferença está em
    como as apurações futuras/atuais consideram o cancelamento (tratado no serviço de bônus).
    """
    if sale.organization_id != organization_id:
        raise BusinessError("forbidden", "Fora da organização", status=403)
    if sale.state == STATE_CANCELLED:
        return sale
    reason = (reason or "").strip()
    if len(reason) < 3:
        raise BusinessError("missing_reason", "Justificativa é obrigatória", status=422)
    sale.state = STATE_CANCELLED
    sale.cancelled_at = now_utc()
    sale.cancelled_reason = reason
    sale.cancelled_kind = CANCEL_AFTER_BONUS if bonus_already_paid else CANCEL_BEFORE_BONUS
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="sale",
        entity_id=str(sale.id),
        action="cancel",
        reason=reason,
        after={"kind": sale.cancelled_kind},
        request_id=request_id,
    )
    return sale


# --- Helpers ---------------------------------------------------------------

def _serialize(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _restore(field: str, value: Any) -> Any:
    if field in {"net_premium", "commission_pct"}:
        return Decimal(str(value))
    if field == "closed_on":
        return date.fromisoformat(value) if isinstance(value, str) else value
    return value
