from datetime import date

from app.modules.schedules.rules import (
    CONTACT_LIMIT_BUSINESS_DAYS,
    WINDOW_MAX_BUSINESS_DAYS,
    WINDOW_MIN_BUSINESS_DAYS,
    contact_limit_on,
    evaluate_schedule,
    window_opens_on,
)
from app.modules.funnel.rendering import render_template


def test_window_between_5_and_7_business_days():
    # Vigência 2026-10-16 (sexta). Sem feriados na janela.
    coverage = date(2026, 10, 16)
    # 7 dias úteis antes: 2026-10-07
    assert window_opens_on(coverage) == date(2026, 10, 7)
    # 2 dias úteis antes (limite RN-011): 2026-10-14
    assert contact_limit_on(coverage) == date(2026, 10, 14)


def test_evaluate_inside_window_shows_contact_label():
    coverage = date(2026, 10, 16)
    view = evaluate_schedule(coverage, today=date(2026, 10, 8))  # 6 dias úteis antes
    assert view.in_window is True
    assert view.can_contact is True
    assert view.past_contact_limit is False
    assert view.label == "Entrar em contato"


def test_evaluate_past_limit_shows_resolve_label():
    coverage = date(2026, 10, 16)
    # 1 dia útil antes → fora do limite (RN-011)
    view = evaluate_schedule(coverage, today=date(2026, 10, 15))
    assert view.past_contact_limit is True
    assert view.can_contact is False
    assert view.label == "Resolver agendamento"


def test_evaluate_after_coverage_end_is_resolve():
    coverage = date(2026, 10, 16)
    view = evaluate_schedule(coverage, today=date(2026, 10, 20))
    assert view.past_contact_limit is True
    assert view.label == "Resolver agendamento"


def test_evaluate_before_window_is_wait():
    coverage = date(2026, 10, 16)
    view = evaluate_schedule(coverage, today=date(2026, 10, 1))  # muito longe
    assert view.in_window is False
    assert view.can_contact is True
    assert view.label == "Aguardar"


def test_message_template_renders_variables_and_ignores_missing():
    tpl = "Olá {nome_cliente}, aqui é {nome_vendedor}. Indicação de {nome_indicador}?"
    rendered = render_template(
        tpl,
        {"nome_cliente": "João", "nome_vendedor": "Maria", "nome_indicador": ""},
    )
    # Placeholder vazio some sem quebrar o texto
    assert "João" in rendered and "Maria" in rendered
    assert "{nome_indicador}" not in rendered
    assert "  " not in rendered


def test_message_template_unknown_placeholder_is_stripped():
    rendered = render_template("Oi {desconhecido} tudo bem?", {})
    assert rendered == "Oi tudo bem?"