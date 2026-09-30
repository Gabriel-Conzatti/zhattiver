from __future__ import annotations

from sqlalchemy import select

from ..extensions import db
from .celery_app import celery_app


@celery_app.task(name="app.jobs.tasks.close_daily_metas")
def close_daily_metas(target_day: str | None = None) -> dict:
    """RN-003: fechamento diário das metas operacionais.

    Placeholder — a implementação real chega na Etapa 4/6, junto com as apurações.
    """
    return {"status": "noop", "target_day": target_day}


@celery_app.task(name="app.jobs.tasks.generate_daily_followups")
def generate_daily_followups_task() -> dict:
    """RN-016/017: materializa follow-ups automáticos em `next_actions`.

    Idempotente por `generation_key`. Executado uma vez por dia útil pelo Beat.
    """
    from ..modules.opportunities.services import generate_daily_followups
    from ..modules.orgs.models import Organization

    total = 0
    for org in db.session.execute(select(Organization)).scalars().all():
        total += generate_daily_followups(organization_id=org.id)
    db.session.commit()
    return {"created": total}
