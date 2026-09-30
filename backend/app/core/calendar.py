from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import select

from ..extensions import db


def is_weekend(day: date) -> bool:
    # segunda=0 ... domingo=6
    return day.weekday() >= 5


def is_business_day(day: date, organization_id: str | None = None) -> bool:
    """RN-001: seg–sex e não é feriado nacional/personalizado."""
    if is_weekend(day):
        return False
    return not _is_holiday(day, organization_id)


def add_business_days(start: date, days: int, organization_id: str | None = None) -> date:
    """Soma `days` dias úteis (positivo ou negativo) a partir de `start`, sem contar o próprio `start`."""
    if days == 0:
        return start
    step = 1 if days > 0 else -1
    remaining = abs(days)
    current = start
    while remaining > 0:
        current = current + timedelta(days=step)
        if is_business_day(current, organization_id):
            remaining -= 1
    return current


def next_business_day(day: date, organization_id: str | None = None) -> date:
    """Retorna o primeiro dia útil estritamente posterior a `day`."""
    current = day + timedelta(days=1)
    while not is_business_day(current, organization_id):
        current = current + timedelta(days=1)
    return current


def business_days_between(start: date, end: date, organization_id: str | None = None) -> int:
    """Quantidade de dias úteis entre `start` (exclusivo) e `end` (inclusivo)."""
    if end < start:
        return -business_days_between(end, start, organization_id)
    count = 0
    current = start
    while current < end:
        current = current + timedelta(days=1)
        if is_business_day(current, organization_id):
            count += 1
    return count


def _is_holiday(day: date, organization_id: str | None) -> bool:
    try:
        from ..modules.calendar.models import Holiday
    except Exception:  # pragma: no cover
        return False

    try:
        stmt = select(Holiday).where(Holiday.date == day)
        if organization_id is None:
            stmt = stmt.where(Holiday.organization_id.is_(None))
        else:
            stmt = stmt.where(
                (Holiday.organization_id == organization_id)
                | (Holiday.organization_id.is_(None))
            )
        return db.session.execute(stmt.limit(1)).first() is not None
    except Exception:
        # Fora de contexto Flask (ex.: testes unitários) devolve False; testes que
        # dependem de feriado devem estar dentro do app context.
        return False


def follow_up_due_date(
    last_relevant_local: date, organization_id: str | None = None
) -> date:
    """RN-016/RN-017: 24h corridas + próximo dia útil estritamente posterior.

    Convertida em datas: o follow-up entra no primeiro dia útil > (last_relevant_local + 1 dia).
    Ex.: seg 16h59 -> +24h => ter 16h59 (data terça) -> próximo útil > terça => quarta.
    """
    reference_day = last_relevant_local + timedelta(days=1)
    return next_business_day(reference_day, organization_id)


__all__ = [
    "add_business_days",
    "business_days_between",
    "follow_up_due_date",
    "is_business_day",
    "is_weekend",
    "next_business_day",
]
