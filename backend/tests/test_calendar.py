from datetime import date

from app.core.calendar import (
    add_business_days,
    follow_up_due_date,
    is_business_day,
    next_business_day,
)


def test_business_days_excluding_weekend():
    # 2026-09-28 é segunda-feira
    assert is_business_day(date(2026, 9, 28))
    # 2026-09-27 é domingo
    assert not is_business_day(date(2026, 9, 27))


def test_add_business_days_forward():
    # Sexta 2026-10-02 + 1 dia útil = segunda 2026-10-05
    assert add_business_days(date(2026, 10, 2), 1) == date(2026, 10, 5)


def test_follow_up_rn016_rn017_canonical_example():
    # Prompt seção 12: contato segunda 16h59 -> follow-up entra na quarta
    assert follow_up_due_date(date(2026, 9, 28)) == date(2026, 9, 30)


def test_next_business_day_skips_weekend():
    # Sexta -> segunda
    assert next_business_day(date(2026, 10, 2)) == date(2026, 10, 5)
