from sqlalchemy import func, select


def test_seed_e2e_creates_isolated_users_and_seller_availability(app, monkeypatch):
    monkeypatch.setenv("LYNK_E2E_RUN_ID", "pytest-1234567")
    monkeypatch.setenv("LYNK_E2E_PASSWORD", "test-password-123")

    result = app.test_cli_runner().invoke(args=["lynk", "seed-e2e"])

    assert result.exit_code == 0, result.output
    assert "run_id=pytest-1234567" in result.output

    from app.extensions import db
    from app.modules.funnel.models import Funnel
    from app.modules.leads.models import Availability
    from app.modules.opportunities.services import _initial_stage
    from app.modules.orgs.models import Organization
    from app.modules.sales.models import STATE_REGISTERED, Sale
    from app.modules.users.models import User

    with app.app_context():
        organization = db.session.execute(
            select(Organization).where(Organization.slug == "e2e-pytest-1234567")
        ).scalar_one()
        users = db.session.execute(
            select(User).where(User.organization_id == organization.id)
        ).scalars().all()
        availability_count = db.session.execute(
            select(func.count())
            .select_from(Availability)
            .where(Availability.organization_id == organization.id)
        ).scalar_one()
        funnel = db.session.execute(
            select(Funnel).where(Funnel.organization_id == organization.id)
        ).scalar_one()
        initial_stage = _initial_stage(funnel.id)
        pending_sale = db.session.execute(
            select(Sale).where(Sale.organization_id == organization.id)
        ).scalar_one()

        assert {user.role for user in users} == {"admin", "sdr", "vendedor"}
        assert all(user.products for user in users if user.role != "admin")
        assert availability_count == 1
        assert initial_stage.is_initial is True
        assert pending_sale.state == STATE_REGISTERED
        assert str(pending_sale.commission_amount) == "300.00"


def test_seed_e2e_requires_run_id_and_password(app, monkeypatch):
    monkeypatch.delenv("LYNK_E2E_RUN_ID", raising=False)
    monkeypatch.delenv("LYNK_E2E_PASSWORD", raising=False)

    result = app.test_cli_runner().invoke(args=["lynk", "seed-e2e"])

    assert result.exit_code != 0
    assert "LYNK_E2E_RUN_ID" in result.output
