from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.auth import hash_password
from app.extensions import db
from app.modules.bonus.models import METRIC_NET_PREMIUM, BonusPayment
from app.modules.catalog.models import ClientType, Insurer
from app.modules.leads.models import Lead
from app.modules.orgs.models import Organization
from app.modules.sales.models import STATE_VALIDATED, Sale
from app.modules.users.models import (
    ROLE_ADMIN,
    ROLE_SDR,
    ROLE_VENDEDOR,
    Product,
    User,
)


@pytest.fixture()
def seeded_data(app):
    with app.app_context():
        org_a = Organization(name="Organização A", slug="org-a")
        org_b = Organization(name="Organização B", slug="org-b")
        db.session.add_all([org_a, org_b])
        db.session.flush()

        product_a = Product(organization_id=org_a.id, name="Auto", slug="auto")
        product_b = Product(organization_id=org_b.id, name="Auto", slug="auto")
        db.session.add_all([product_a, product_b])
        db.session.flush()

        seller_a = User(
            organization_id=org_a.id,
            email="vendedor-a@example.com",
            name="Vendedor A",
            password_hash=hash_password("senha-segura"),
            role=ROLE_VENDEDOR,
        )
        seller_b = User(
            organization_id=org_a.id,
            email="vendedor-b@example.com",
            name="Vendedor B",
            password_hash=hash_password("senha-segura"),
            role=ROLE_VENDEDOR,
        )
        sdr_a = User(
            organization_id=org_a.id,
            email="sdr-a@example.com",
            name="SDR A",
            password_hash=hash_password("senha-segura"),
            role=ROLE_SDR,
        )
        admin_a = User(
            organization_id=org_a.id,
            email="admin-a@example.com",
            name="Admin A",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        admin_b = User(
            organization_id=org_b.id,
            email="admin-b@example.com",
            name="Admin B",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        seller_a.products.append(product_a)
        seller_b.products.append(product_a)
        sdr_a.products.append(product_a)

        lead_a = Lead(organization_id=org_a.id, name="Cliente A")
        lead_b = Lead(organization_id=org_a.id, name="Cliente B")
        client_type_a = ClientType(organization_id=org_a.id, name="Pessoa Física", slug="pf")
        insurer_a = Insurer(organization_id=org_a.id, name="Seguradora A")
        db.session.add_all(
            [
                seller_a,
                seller_b,
                sdr_a,
                admin_a,
                admin_b,
                lead_a,
                lead_b,
                client_type_a,
                insurer_a,
            ]
        )
        db.session.flush()

        now = datetime.now(UTC)
        sale_a = Sale(
            organization_id=org_a.id,
            lead_id=lead_a.id,
            product_id=product_a.id,
            seller_user_id=seller_a.id,
            insurer_id=insurer_a.id,
            client_type_id=client_type_a.id,
            net_premium=Decimal("1500.00"),
            commission_pct=Decimal("0.15"),
            commission_amount=Decimal("225.00"),
            closed_on=date(2026, 10, 1),
            registered_at=now,
            edit_deadline_at=now,
            state=STATE_VALIDATED,
        )
        sale_b = Sale(
            organization_id=org_a.id,
            lead_id=lead_b.id,
            product_id=product_a.id,
            seller_user_id=seller_b.id,
            insurer_id=insurer_a.id,
            client_type_id=client_type_a.id,
            net_premium=Decimal("2500.00"),
            commission_pct=Decimal("0.12"),
            commission_amount=Decimal("300.00"),
            closed_on=date(2026, 10, 2),
            registered_at=now,
            edit_deadline_at=now,
            state=STATE_VALIDATED,
        )
        bonus_b = BonusPayment(
            organization_id=org_a.id,
            user_id=seller_b.id,
            product_id=product_a.id,
            year=2026,
            month=10,
            predicted_on=date(2026, 11, 20),
            metric_base=METRIC_NET_PREMIUM,
            metric_value=Decimal("2500.00"),
            amount=Decimal("300.00"),
        )
        db.session.add_all([sale_a, sale_b, bonus_b])
        db.session.commit()
        return {
            "admin_a": {"email": admin_a.email},
            "admin_b": {"email": admin_b.email},
            "sdr_a": {"email": sdr_a.email},
            "seller_a": {"email": seller_a.email},
            "seller_b": {"email": seller_b.email},
            "sale_a": {"id": str(sale_a.id)},
            "sale_b": {"id": str(sale_b.id)},
        }


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "senha-segura"},
    )
    assert response.status_code == 200


def test_sdr_cannot_list_or_read_sales(client, seeded_data):
    _login(client, seeded_data["sdr_a"])

    list_response = client.get("/api/v1/sales?scope=all")
    detail_response = client.get(f"/api/v1/sales/{seeded_data['sale_a']['id']}")

    assert list_response.status_code == 403
    assert detail_response.status_code == 403


def test_sdr_cannot_list_or_read_opportunities(client, seeded_data):
    _login(client, seeded_data["sdr_a"])

    list_response = client.get("/api/v1/opportunities?scope=all")
    detail_response = client.get("/api/v1/opportunities/00000000-0000-0000-0000-000000000000")

    assert list_response.status_code == 403
    assert detail_response.status_code == 403


def test_seller_cannot_read_another_seller_financial_data(client, seeded_data):
    _login(client, seeded_data["seller_a"])

    list_response = client.get("/api/v1/sales?scope=all")
    detail_response = client.get(f"/api/v1/sales/{seeded_data['sale_b']['id']}")

    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.get_json()["items"]] == [
        seeded_data["sale_a"]["id"]
    ]
    own_sale = list_response.get_json()["items"][0]
    assert own_sale["net_premium"] == "1500.00"
    assert own_sale["commission_pct"] == "0.1500"
    assert "commission_amount" not in own_sale
    assert detail_response.status_code == 403


def test_other_organization_cannot_read_sale(client, seeded_data):
    _login(client, seeded_data["admin_b"])

    response = client.get(f"/api/v1/sales/{seeded_data['sale_a']['id']}")

    assert response.status_code == 404


def test_bonus_amount_is_not_exposed_without_own_grant(client, seeded_data):
    _login(client, seeded_data["seller_b"])

    response = client.get("/api/v1/me/bonus?year=2026&month=10")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["available"] is True
    assert payload["amount"] is None

    response = client.get("/api/v1/admin/bonus?year=2026&month=10")
    assert response.status_code == 403


def test_admin_bonus_listing_isolated_by_organization(client, seeded_data):
    _login(client, seeded_data["admin_b"])

    response = client.get("/api/v1/admin/bonus?year=2026&month=10")

    assert response.status_code == 200
    assert response.get_json()["items"] == []


def test_mutations_require_and_accept_csrf_token(client, seeded_data):
    _login(client, seeded_data["admin_a"])

    missing_token = client.post("/api/v1/notifications/read-all", json={})

    assert missing_token.status_code == 403
    assert missing_token.get_json()["error"]["code"] == "csrf_invalid"

    csrf = client.get_cookie("lynk_csrf")
    assert csrf is not None
    valid_token = client.post(
        "/api/v1/notifications/read-all",
        json={},
        headers={"X-CSRF-Token": csrf.value},
    )
    assert valid_token.status_code == 204
