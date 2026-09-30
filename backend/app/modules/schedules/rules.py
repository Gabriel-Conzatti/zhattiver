"""Regras de estado do agendamento (RN-009..RN-015)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from ...core.calendar import add_business_days, business_days_between
from ...core.time import today_local


WINDOW_MIN_BUSINESS_DAYS = 5
WINDOW_MAX_BUSINESS_DAYS = 7
CONTACT_LIMIT_BUSINESS_DAYS = 2


@dataclass(frozen=True)
class ScheduleView:
    """Resumo de exigibilidade calculado on-the-fly a partir da vigência."""

    coverage_end_date: date
    today: date
    business_days_remaining: int
    in_window: bool
    can_contact: bool
    past_contact_limit: bool
    label: str  # "Entrar em contato" | "Resolver agendamento" | "Aguardar" | "Encerrado"


def evaluate_schedule(coverage_end_date: date, *, today: date | None = None) -> ScheduleView:
    """Aplica RN-009/011/012.

    - Entre 5 e 7 dias úteis antes da vigência → destaque (in_window=True).
    - Até 2 dias úteis antes da vigência → pode contatar.
    - Após esse limite (business_days_remaining < 2) → "Resolver agendamento".
    """
    today = today or today_local()
    if coverage_end_date < today:
        # Já venceu
        return ScheduleView(
            coverage_end_date=coverage_end_date,
            today=today,
            business_days_remaining=business_days_between(today, coverage_end_date),
            in_window=False,
            can_contact=False,
            past_contact_limit=True,
            label="Resolver agendamento",
        )

    remaining = business_days_between(today, coverage_end_date)
    in_window = WINDOW_MIN_BUSINESS_DAYS <= remaining <= WINDOW_MAX_BUSINESS_DAYS
    can_contact = remaining >= CONTACT_LIMIT_BUSINESS_DAYS
    past_limit = not can_contact

    if past_limit:
        label = "Resolver agendamento"
    elif in_window or remaining < WINDOW_MIN_BUSINESS_DAYS:
        # Se caiu dentro dos 2..7 dias úteis, cabe abordagem normal.
        label = "Entrar em contato"
    else:
        label = "Aguardar"

    return ScheduleView(
        coverage_end_date=coverage_end_date,
        today=today,
        business_days_remaining=remaining,
        in_window=in_window,
        can_contact=can_contact,
        past_contact_limit=past_limit,
        label=label,
    )


def window_opens_on(coverage_end_date: date) -> date:
    """Data em que o item entra na janela ideal (RN-009)."""
    return add_business_days(coverage_end_date, -WINDOW_MAX_BUSINESS_DAYS)


def contact_limit_on(coverage_end_date: date) -> date:
    """Último dia útil em que ainda cabe abordagem (RN-011)."""
    return add_business_days(coverage_end_date, -CONTACT_LIMIT_BUSINESS_DAYS)
