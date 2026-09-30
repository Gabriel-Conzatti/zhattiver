from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from flask_login import login_required
from sqlalchemy import select

from ...core.audit import record
from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import now_utc
from ...extensions import db
from ..leads import services as lead_services
from ..users.models import ROLE_ADMIN, ROLE_SDR
from .models import (
    ImportBatch,
    ImportRow,
    ROW_STATUS_DUPLICATE,
    ROW_STATUS_ERROR,
    ROW_STATUS_OK,
    STATUS_CONFIRMED,
    STATUS_REVIEWING,
    TYPE_LEADS,
)
from .parser import parse_leads_file

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MiB
MAX_ROWS = 5000

bp = Blueprint("imports", __name__)


def _require_sdr_or_admin() -> None:
    ctx = load_context()
    if ctx.role not in (ROLE_ADMIN, ROLE_SDR):
        raise BusinessError("forbidden", "Somente admin/SDR", status=403)


@bp.get("/imports")
@login_required
def list_batches():
    _require_sdr_or_admin()
    ctx = load_context()
    rows = db.session.execute(
        select(ImportBatch)
        .where(ImportBatch.organization_id == ctx.organization_id)
        .order_by(ImportBatch.created_at.desc())
        .limit(50)
    ).scalars().all()
    return jsonify(
        {
            "items": [
                {
                    "id": str(b.id),
                    "type": b.type,
                    "status": b.status,
                    "filename": b.filename,
                    "rows_total": b.rows_total,
                    "rows_ok": b.rows_ok,
                    "rows_error": b.rows_error,
                    "rows_duplicate": b.rows_duplicate,
                    "created_at": b.created_at.isoformat(),
                }
                for b in rows
            ]
        }
    )


@bp.post("/imports/leads")
@login_required
def upload_leads():
    _require_sdr_or_admin()
    ctx = load_context()

    if "file" not in request.files:
        raise BusinessError("missing_file", "Envie um arquivo em 'file'", status=422)
    upload = request.files["file"]
    if not upload.filename:
        raise BusinessError("missing_file", "Arquivo sem nome", status=422)
    lower = upload.filename.lower()
    if not (lower.endswith(".csv") or lower.endswith(".xlsx")):
        raise BusinessError("invalid_type", "Apenas CSV ou XLSX", status=422)

    file_bytes = upload.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise BusinessError("too_large", "Arquivo maior que 8 MiB", status=413)

    parsed, headers = parse_leads_file(upload.filename, file_bytes)
    if len(parsed) > MAX_ROWS:
        raise BusinessError(
            "too_many_rows",
            f"Arquivo tem {len(parsed)} linhas (máximo {MAX_ROWS})",
            status=413,
        )

    batch = ImportBatch(
        organization_id=ctx.organization_id,
        type=TYPE_LEADS,
        status=STATUS_REVIEWING,
        filename=upload.filename[:200],
        rows_total=len(parsed),
        created_by=ctx.user_id,
    )
    db.session.add(batch)
    db.session.flush()

    # Detecta duplicados dentro do lote e contra o banco.
    seen_in_batch: set[str] = set()
    rows_ok = rows_dup = rows_err = 0

    for parsed_row in parsed:
        status = ROW_STATUS_OK
        duplicate_of: str | None = None
        errors = list(parsed_row.errors)

        if parsed_row.normalized:
            e164 = parsed_row.normalized["phones"][0]["e164"]
            if e164 in seen_in_batch:
                status = ROW_STATUS_DUPLICATE
                errors.append("Duplicado dentro do lote")
            else:
                seen_in_batch.add(e164)
                dup_lead = lead_services.find_duplicate_by_phones(
                    organization_id=ctx.organization_id, e164_phones=[e164]
                )
                if dup_lead is not None:
                    status = ROW_STATUS_DUPLICATE
                    duplicate_of = dup_lead.id
                    errors.append("Duplicado no cadastro existente")
        else:
            status = ROW_STATUS_ERROR

        if status == ROW_STATUS_OK:
            rows_ok += 1
        elif status == ROW_STATUS_DUPLICATE:
            rows_dup += 1
        else:
            rows_err += 1

        db.session.add(
            ImportRow(
                batch_id=batch.id,
                organization_id=ctx.organization_id,
                line_no=parsed_row.line_no,
                payload=parsed_row.raw,
                normalized=parsed_row.normalized,
                errors=errors or None,
                status=status,
                duplicate_of_lead_id=duplicate_of,
            )
        )

    batch.rows_ok = rows_ok
    batch.rows_error = rows_err
    batch.rows_duplicate = rows_dup

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="import_batch",
        entity_id=str(batch.id),
        action="upload",
        after={
            "filename": batch.filename,
            "rows_total": batch.rows_total,
            "rows_ok": rows_ok,
            "rows_duplicate": rows_dup,
            "rows_error": rows_err,
            "headers": headers,
        },
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"id": str(batch.id), "status": batch.status}), 201


@bp.get("/imports/<batch_id>")
@login_required
def get_batch(batch_id: str):
    _require_sdr_or_admin()
    ctx = load_context()
    batch = db.session.get(ImportBatch, batch_id)
    if batch is None or batch.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Lote não encontrado", status=404)
    rows = db.session.execute(
        select(ImportRow).where(ImportRow.batch_id == batch.id).order_by(ImportRow.line_no).limit(500)
    ).scalars().all()
    return jsonify(
        {
            "id": str(batch.id),
            "status": batch.status,
            "filename": batch.filename,
            "rows_total": batch.rows_total,
            "rows_ok": batch.rows_ok,
            "rows_error": batch.rows_error,
            "rows_duplicate": batch.rows_duplicate,
            "rows": [
                {
                    "id": str(r.id),
                    "line_no": r.line_no,
                    "status": r.status,
                    "errors": r.errors,
                    "payload": r.payload,
                    "normalized": r.normalized,
                    "duplicate_of_lead_id": r.duplicate_of_lead_id,
                }
                for r in rows
            ],
        }
    )


@bp.post("/imports/<batch_id>/confirm")
@login_required
def confirm_batch(batch_id: str):
    """Cria os leads das linhas OK e devolve resumo. Duplicidades ficam para revisão manual."""
    _require_sdr_or_admin()
    ctx = load_context()
    batch = db.session.get(ImportBatch, batch_id)
    if batch is None or batch.organization_id != ctx.organization_id:
        raise BusinessError("not_found", "Lote não encontrado", status=404)
    if batch.status == STATUS_CONFIRMED:
        return jsonify({"status": batch.status, "created": 0}), 200

    rows = db.session.execute(
        select(ImportRow).where(
            ImportRow.batch_id == batch.id,
            ImportRow.status == ROW_STATUS_OK,
        )
    ).scalars().all()

    created = 0
    failed = 0
    for row in rows:
        data = row.normalized or {}
        try:
            lead_services.create_lead(
                organization_id=ctx.organization_id,
                actor_user_id=ctx.user_id,
                data=lead_services.LeadInput(
                    name=data.get("name"),
                    phones=[p["original"] for p in data.get("phones", [])],
                    document=data.get("document"),
                    city=data.get("city"),
                    state=data.get("state"),
                    indicator_name=data.get("indicator_name"),
                    notes=data.get("notes"),
                    vehicles=[data["vehicle"]] if data.get("vehicle") and any(data["vehicle"].values()) else [],
                ),
                request_id=getattr(g, "request_id", None),
            )
            created += 1
        except BusinessError as exc:
            failed += 1
            row.status = ROW_STATUS_DUPLICATE if exc.code == "duplicate_lead" else ROW_STATUS_ERROR
            row.errors = (row.errors or []) + [exc.message]

    batch.status = STATUS_CONFIRMED
    batch.completed_at = now_utc()

    record(
        organization_id=ctx.organization_id,
        actor_user_id=ctx.user_id,
        entity_type="import_batch",
        entity_id=str(batch.id),
        action="confirm",
        after={"created": created, "failed": failed},
        request_id=getattr(g, "request_id", None),
    )
    db.session.commit()
    return jsonify({"status": batch.status, "created": created, "failed": failed})
