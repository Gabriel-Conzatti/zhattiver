from __future__ import annotations

from typing import Any

from sqlalchemy import select

from ...extensions import db
from .models import Notification


def notify(
    *,
    organization_id: str,
    user_id: str,
    kind: str,
    title: str,
    body: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    link_path: str | None = None,
    data: dict[str, Any] | None = None,
    dedup_key: str | None = None,
) -> Notification | None:
    """Cria a notificação, respeitando `dedup_key` (evita repetidos para o mesmo usuário)."""
    if dedup_key:
        existing = db.session.execute(
            select(Notification).where(
                Notification.organization_id == organization_id,
                Notification.user_id == user_id,
                Notification.dedup_key == dedup_key,
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing
    n = Notification(
        organization_id=organization_id,
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        link_path=link_path,
        data=data,
        dedup_key=dedup_key,
    )
    db.session.add(n)
    return n


def notify_admins(
    *,
    organization_id: str,
    kind: str,
    title: str,
    **kwargs: Any,
) -> None:
    """Envia a mesma notificação para todos os administradores da organização."""
    from ..users.models import ROLE_ADMIN, User

    admins = db.session.execute(
        select(User).where(
            User.organization_id == organization_id,
            User.role == ROLE_ADMIN,
            User.is_active.is_(True),
        )
    ).scalars().all()
    for admin in admins:
        notify(
            organization_id=organization_id,
            user_id=admin.id,
            kind=kind,
            title=title,
            **kwargs,
        )
