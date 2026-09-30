from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import select

from ...core.audit import record as audit_record
from ...core.errors import BusinessError
from ...core.phones import PhoneNormalizationError, normalize_phone
from ...core.time import now_utc
from ...extensions import db
from .models import KINDS, Lead, LeadPhone, Vehicle


@dataclass
class LeadInput:
    name: str
    kind: str = "pf"
    phones: list[str] | None = None
    document: str | None = None
    city: str | None = None
    state: str | None = None
    indicator_name: str | None = None
    notes: str | None = None
    origin_id: str | None = None
    client_type_id: str | None = None
    vehicles: list[dict] | None = None


def _normalize_phones(raws: Iterable[str]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw in raws:
        raw = (raw or "").strip()
        if not raw:
            continue
        try:
            e164 = normalize_phone(raw)
        except PhoneNormalizationError as exc:
            raise BusinessError(
                "invalid_phone",
                f"Telefone inválido: {raw}",
                status=422,
                details={"phone": raw, "reason": str(exc)},
            )
        if e164 in seen:
            continue
        seen.add(e164)
        out.append((e164, raw))
    return out


def find_duplicate_by_phones(
    *, organization_id: str, e164_phones: Iterable[str]
) -> Lead | None:
    phones = list(e164_phones)
    if not phones:
        return None
    stmt = (
        select(Lead)
        .join(LeadPhone, LeadPhone.lead_id == Lead.id)
        .where(
            LeadPhone.organization_id == organization_id,
            LeadPhone.phone_e164.in_(phones),
        )
        .limit(1)
    )
    return db.session.execute(stmt).scalar_one_or_none()


def create_lead(
    *,
    organization_id: str,
    actor_user_id: str,
    data: LeadInput,
    request_id: str | None = None,
) -> Lead:
    if data.kind not in KINDS:
        raise BusinessError("invalid_kind", "Tipo de pessoa inválido", status=422)
    if not data.name or not data.name.strip():
        raise BusinessError("invalid_name", "Nome é obrigatório", status=422)

    phones = _normalize_phones(data.phones or [])
    if not phones:
        raise BusinessError(
            "missing_phone", "Informe pelo menos um telefone", status=422
        )

    duplicate = find_duplicate_by_phones(
        organization_id=organization_id,
        e164_phones=[e164 for e164, _ in phones],
    )
    if duplicate is not None:
        raise BusinessError(
            "duplicate_lead",
            "Já existe lead com esse telefone",
            status=409,
            details={"lead_id": str(duplicate.id), "lead_name": duplicate.name},
        )

    lead = Lead(
        organization_id=organization_id,
        kind=data.kind,
        name=data.name.strip(),
        document=(data.document or "").strip() or None,
        city=(data.city or "").strip() or None,
        state=(data.state or "").upper().strip() or None,
        indicator_name=(data.indicator_name or "").strip() or None,
        notes=data.notes,
        origin_id=data.origin_id,
        client_type_id=data.client_type_id,
        created_by=actor_user_id,
    )
    db.session.add(lead)
    db.session.flush()

    for idx, (e164, original) in enumerate(phones):
        db.session.add(
            LeadPhone(
                organization_id=organization_id,
                lead_id=lead.id,
                phone_e164=e164,
                original=original,
                is_primary=idx == 0,
            )
        )

    for vehicle in data.vehicles or []:
        plate = (vehicle.get("plate") or "").upper().strip() or None
        model = (vehicle.get("model") or "").strip() or None
        year = vehicle.get("year")
        if not (plate or model):
            continue
        db.session.add(
            Vehicle(
                organization_id=organization_id,
                lead_id=lead.id,
                plate=plate,
                model=model,
                year=int(year) if year else None,
                notes=(vehicle.get("notes") or "").strip() or None,
            )
        )

    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="lead",
        entity_id=str(lead.id),
        action="create",
        after={
            "name": lead.name,
            "kind": lead.kind,
            "phones": [e164 for e164, _ in phones],
        },
        request_id=request_id,
    )
    return lead


def archive_lead(
    *,
    organization_id: str,
    actor_user_id: str,
    lead: Lead,
    reason: str | None,
    request_id: str | None = None,
) -> None:
    if lead.organization_id != organization_id:
        raise BusinessError("forbidden", "Registro fora da organização", status=403)
    if lead.archived_at is not None:
        return
    lead.archived_at = now_utc()
    audit_record(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type="lead",
        entity_id=str(lead.id),
        action="archive",
        reason=reason,
        request_id=request_id,
    )
