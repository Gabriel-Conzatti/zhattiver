from datetime import date, datetime, timezone
from decimal import Decimal

from app.modules.bonus.services import predicted_payment_date
from app.modules.sales.services import calc_commission, compute_edit_deadline


def test_commission_calculation_two_thousand_at_fifteen_pct():
    # RN-033: R$ 2.000,00 × 15% = R$ 300,00
    assert calc_commission(Decimal("2000.00"), Decimal("0.15")) == Decimal("300.00")


def test_commission_rounds_half_up():
    assert calc_commission(Decimal("1234.56"), Decimal("0.1234")) == Decimal("152.35")


def test_edit_deadline_from_registered_at_uses_next_business_day():
    # Sexta 2026-10-02 16h00 UTC -> próximo dia útil = 2026-10-05 (segunda)
    registered = datetime(2026, 10, 2, 16, 0, tzinfo=timezone.utc)
    deadline = compute_edit_deadline(registered)
    assert deadline.date() == date(2026, 10, 6)  # 23h59 local de 05/10 vira 06/10 UTC


def test_predicted_payment_date_uses_next_month_day_20():
    # RN-039
    assert predicted_payment_date(2026, 3) == date(2026, 4, 20)
    assert predicted_payment_date(2026, 12) == date(2027, 1, 20)
