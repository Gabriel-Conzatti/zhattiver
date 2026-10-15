from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace

from app.modules.bonus.models import BONUS_KIND_FIXED
from app.modules.bonus.services import _apply_rule, predicted_payment_date
from app.modules.sales.services import calc_commission, compute_edit_deadline


def test_commission_calculation_two_thousand_at_fifteen_pct():
    # RN-033: R$ 2.000,00 × 15% = R$ 300,00
    assert calc_commission(Decimal("2000.00"), Decimal("0.15")) == Decimal("300.00")


def test_commission_rounds_half_up():
    # 1234.56 x 0.1234 = 152.344704 -> arredonda para baixo (3o decimal = 4)
    assert calc_commission(Decimal("1234.56"), Decimal("0.1234")) == Decimal("152.34")
    # Caso de empate real (3o decimal = 5): 100.00 x 0.10125 = 10.125 -> HALF_UP = 10.13
    assert calc_commission(Decimal("100.00"), Decimal("0.10125")) == Decimal("10.13")


def test_edit_deadline_from_registered_at_uses_next_business_day():
    # Sexta 2026-10-02 16h00 UTC -> próximo dia útil = 2026-10-05 (segunda)
    registered = datetime(2026, 10, 2, 16, 0, tzinfo=UTC)
    deadline = compute_edit_deadline(registered)
    assert deadline.date() == date(2026, 10, 6)  # 23h59 local de 05/10 vira 06/10 UTC


def test_predicted_payment_date_uses_next_month_day_20():
    # RN-039
    assert predicted_payment_date(2026, 3) == date(2026, 4, 20)
    assert predicted_payment_date(2026, 12) == date(2027, 1, 20)


def test_fixed_bonus_value_is_paid_per_validated_sale():
    rule = SimpleNamespace(bonus_kind=BONUS_KIND_FIXED, value=Decimal("10.00"))

    assert _apply_rule(rule, metric_value=Decimal("12"), sale_count=12) == Decimal("120.00")


def test_count_brackets_use_exclusive_upper_bound_and_value_per_sale(app, monkeypatch):
    from sqlalchemy import select

    from app.extensions import db
    from app.modules.bonus.models import METRIC_COUNT, BonusRule
    from app.modules.bonus.services import compute_bonus_for_month
    from app.modules.orgs.models import Organization
    from app.modules.sales.models import STATE_CANCELLED, STATE_VALIDATED, Sale

    monkeypatch.setenv("LYNK_E2E_RUN_ID", "bonus-count-brackets")
    monkeypatch.setenv("LYNK_E2E_PASSWORD", "test-password-123")
    result = app.test_cli_runner().invoke(args=["lynk", "seed-e2e"])
    assert result.exit_code == 0, result.output

    with app.app_context():
        organization = db.session.execute(
            select(Organization).where(Organization.slug == "e2e-bonus-count-brackets")
        ).scalar_one()
        seed_sale = db.session.execute(
            select(Sale).where(Sale.organization_id == organization.id)
        ).scalar_one()
        seed_sale.state = STATE_VALIDATED
        extra_sales = []
        for _ in range(14):
            sale = Sale(
                organization_id=seed_sale.organization_id,
                lead_id=seed_sale.lead_id,
                product_id=seed_sale.product_id,
                seller_user_id=seed_sale.seller_user_id,
                insurer_id=seed_sale.insurer_id,
                client_type_id=seed_sale.client_type_id,
                net_premium=seed_sale.net_premium,
                commission_pct=seed_sale.commission_pct,
                commission_amount=seed_sale.commission_amount,
                closed_on=seed_sale.closed_on,
                origin="test",
                registered_at=seed_sale.registered_at,
                edit_deadline_at=seed_sale.edit_deadline_at,
                state=STATE_VALIDATED,
            )
            db.session.add(sale)
            extra_sales.append(sale)

        first_rule = BonusRule(
            organization_id=organization.id,
            product_id=seed_sale.product_id,
            name="De 10 até 15",
            base=METRIC_COUNT,
            bracket_min=Decimal("10"),
            bracket_max=Decimal("15"),
            bonus_kind=BONUS_KIND_FIXED,
            value=Decimal("10.00"),
            effective_from=date(seed_sale.closed_on.year, seed_sale.closed_on.month, 1),
        )
        second_rule = BonusRule(
            organization_id=organization.id,
            product_id=seed_sale.product_id,
            name="De 15 até 20",
            base=METRIC_COUNT,
            bracket_min=Decimal("15"),
            bracket_max=Decimal("20"),
            bonus_kind=BONUS_KIND_FIXED,
            value=Decimal("15.00"),
            effective_from=date(seed_sale.closed_on.year, seed_sale.closed_on.month, 1),
        )
        db.session.add_all([first_rule, second_rule])
        db.session.commit()

        at_fifteen = compute_bonus_for_month(
            organization_id=organization.id,
            user_id=seed_sale.seller_user_id,
            product_id=seed_sale.product_id,
            year=seed_sale.closed_on.year,
            month=seed_sale.closed_on.month,
            metric_base=METRIC_COUNT,
        )
        assert at_fifteen.metric_value == Decimal("15")
        assert at_fifteen.amount == Decimal("225.00")
        assert at_fifteen.applied_rule_id == str(second_rule.id)

        extra_sales[0].state = STATE_CANCELLED
        db.session.commit()
        at_fourteen = compute_bonus_for_month(
            organization_id=organization.id,
            user_id=seed_sale.seller_user_id,
            product_id=seed_sale.product_id,
            year=seed_sale.closed_on.year,
            month=seed_sale.closed_on.month,
            metric_base=METRIC_COUNT,
        )
        assert at_fourteen.metric_value == Decimal("14")
        assert at_fourteen.amount == Decimal("140.00")
        assert at_fourteen.applied_rule_id == str(first_rule.id)


def test_only_validated_sales_compose_production_goals_and_bonus(app, monkeypatch):
    from sqlalchemy import select

    from app.extensions import db
    from app.modules.bonus.models import BONUS_KIND_PERCENT, METRIC_NET_PREMIUM, BonusRule
    from app.modules.bonus.services import (
        compute_bonus_for_month,
        eligible_seller_product_pairs,
        month_sales_summary,
    )
    from app.modules.orgs.models import Organization
    from app.modules.sales.models import (
        STATE_CANCELLED,
        STATE_REGISTERED,
        STATE_REVISION_PENDING,
        STATE_VALIDATED,
        Sale,
    )
    from app.modules.users.models import Product

    def seed(run_id: str):
        monkeypatch.setenv("LYNK_E2E_RUN_ID", run_id)
        monkeypatch.setenv("LYNK_E2E_PASSWORD", "test-password-123")
        result = app.test_cli_runner().invoke(args=["lynk", "seed-e2e"])
        assert result.exit_code == 0, result.output

    seed("rn038-primary")
    seed("rn038-external")

    with app.app_context():
        organization = db.session.execute(
            select(Organization).where(Organization.slug == "e2e-rn038-primary")
        ).scalar_one()
        external_organization = db.session.execute(
            select(Organization).where(Organization.slug == "e2e-rn038-external")
        ).scalar_one()
        registered = db.session.execute(
            select(Sale).where(Sale.organization_id == organization.id)
        ).scalar_one()
        external_sale = db.session.execute(
            select(Sale).where(Sale.organization_id == external_organization.id)
        ).scalar_one()
        other_product = Product(
            organization_id=organization.id,
            name="Residencial",
            slug="residencial-rn038",
        )
        db.session.add(other_product)
        db.session.flush()
        assert registered.state == STATE_REGISTERED

        def clone_sale(*, state: str, net_premium: str, product_id: str) -> Sale:
            premium = Decimal(net_premium)
            sale = Sale(
                organization_id=registered.organization_id,
                lead_id=registered.lead_id,
                product_id=product_id,
                seller_user_id=registered.seller_user_id,
                insurer_id=registered.insurer_id,
                client_type_id=registered.client_type_id,
                net_premium=premium,
                commission_pct=Decimal("0.10"),
                commission_amount=premium * Decimal("0.10"),
                closed_on=registered.closed_on,
                origin="test",
                registered_at=registered.registered_at,
                edit_deadline_at=registered.edit_deadline_at,
                state=state,
            )
            db.session.add(sale)
            return sale

        clone_sale(
            state=STATE_VALIDATED,
            net_premium="3000.00",
            product_id=registered.product_id,
        )
        clone_sale(
            state=STATE_REVISION_PENDING,
            net_premium="4000.00",
            product_id=registered.product_id,
        )
        clone_sale(
            state=STATE_CANCELLED,
            net_premium="5000.00",
            product_id=registered.product_id,
        )
        clone_sale(
            state=STATE_VALIDATED,
            net_premium="7000.00",
            product_id=other_product.id,
        )
        external_sale.state = STATE_VALIDATED
        db.session.add(
            BonusRule(
                organization_id=organization.id,
                product_id=registered.product_id,
                name="10% da produção validada",
                base=METRIC_NET_PREMIUM,
                bracket_min=Decimal("0"),
                bracket_max=None,
                bonus_kind=BONUS_KIND_PERCENT,
                value=Decimal("0.10"),
                effective_from=date(registered.closed_on.year, registered.closed_on.month, 1),
            )
        )
        db.session.commit()

        summary = month_sales_summary(
            organization_id=organization.id,
            user_id=registered.seller_user_id,
            product_id=registered.product_id,
            year=registered.closed_on.year,
            month=registered.closed_on.month,
        )
        bonus = compute_bonus_for_month(
            organization_id=organization.id,
            user_id=registered.seller_user_id,
            product_id=registered.product_id,
            year=registered.closed_on.year,
            month=registered.closed_on.month,
        )
        pairs = eligible_seller_product_pairs(
            organization_id=organization.id,
            year=registered.closed_on.year,
            month=registered.closed_on.month,
        )

        assert summary == {
            "count": 1,
            "net_premium": Decimal("3000.00"),
            "commission_amount": Decimal("300.00"),
        }
        assert bonus.metric_value == Decimal("3000.00")
        assert bonus.amount == Decimal("300.00")
        assert set(pairs) == {
            (str(registered.seller_user_id), str(registered.product_id)),
            (str(registered.seller_user_id), str(other_product.id)),
        }
