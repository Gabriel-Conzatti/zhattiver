from __future__ import annotations

from typing import Any

from ..extensions import db
from .time import now_utc


def record(
    *,
    organization_id: str,
    actor_user_id: str | None,
    entity_type: str,
    entity_id: str | None,
    action: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    reason: str | None = None,
    request_id: str | None = None,
) -> None:
    """Grava uma linha de auditoria na sessão SQLAlchemy atual.

    Deve ser chamado dentro da mesma transação da operação. Nunca contém senhas,
    tokens ou cookies; o chamador é responsável por sanitizar `before`/`after`.
    """
    from ..modules.audit.models import AuditLog

    entry = AuditLog(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before=before,
        after=after,
        reason=reason,
        request_id=request_id,
        occurred_at=now_utc(),
    )
    db.session.add(entry)
