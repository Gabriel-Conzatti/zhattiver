from datetime import date

from app.modules.opportunities.services import suggest_recycle_date


def test_recycle_suggestion_keeps_day_month_next_year():
    assert suggest_recycle_date(date(2026, 10, 16)) == date(2027, 10, 16)


def test_recycle_suggestion_handles_feb_29():
    # 29/02/2028 é bissexto; ano seguinte (2029) não é
    assert suggest_recycle_date(date(2028, 2, 29)) == date(2029, 2, 28)
