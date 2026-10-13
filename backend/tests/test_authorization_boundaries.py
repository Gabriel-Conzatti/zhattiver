from datetime import UTC, date, datetime
from decimal import Decimal

import pytest

from app.core.auth import hash_password
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.bonus.models import METRIC_NET_PREMIUM, BonusPayment
from app.modules.catalog.models import ClientType, Insurer, Origin
from app.modules.funnel.models import Funnel
from app.modules.leads.models import Lead
from app.modules.notifications.models import Notification
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
        lead_external = Lead(organization_id=org_b.id, name="Cliente Externo")
        client_type_a = ClientType(organization_id=org_a.id, name="Pessoa Física", slug="pf")
        insurer_a = Insurer(organization_id=org_a.id, name="Seguradora A")
        origin_external = Origin(organization_id=org_b.id, name="Origem Externa", slug="externa")
        db.session.add_all(
            [
                seller_a,
                seller_b,
                sdr_a,
                admin_a,
                admin_b,
                lead_a,
                lead_b,
                lead_external,
                client_type_a,
                insurer_a,
                origin_external,
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
        notification_b = Notification(
            organization_id=org_a.id,
            user_id=seller_b.id,
            kind="sale_pending",
            title="Venda pendente",
        )
        audit_a = AuditLog(
            organization_id=org_a.id,
            actor_user_id=admin_a.id,
            entity_type="sale",
            entity_id=sale_a.id,
            action="validate",
            occurred_at=now,
        )
        audit_b = AuditLog(
            organization_id=org_b.id,
            actor_user_id=admin_b.id,
            entity_type="sale",
            entity_id=None,
            action="validate",
            occurred_at=now,
        )
        db.session.add_all([sale_a, sale_b, bonus_b, notification_b, audit_a, audit_b])
        db.session.commit()
        return {
            "org_a": {"id": str(org_a.id)},
            "org_b": {"id": str(org_b.id)},
            "admin_a": {"id": str(admin_a.id), "email": admin_a.email},
            "admin_b": {"id": str(admin_b.id), "email": admin_b.email},
            "sdr_a": {"id": str(sdr_a.id), "email": sdr_a.email},
            "seller_a": {"id": str(seller_a.id), "email": seller_a.email},
            "seller_b": {"id": str(seller_b.id), "email": seller_b.email},
            "sale_a": {"id": str(sale_a.id)},
            "sale_b": {"id": str(sale_b.id)},
            "lead_a": {"id": str(lead_a.id)},
            "lead_external": {"id": str(lead_external.id)},
            "product_a": {"id": str(product_a.id)},
            "product_b": {"id": str(product_b.id)},
            "origin_external": {"id": str(origin_external.id)},
            "notification_b": {"id": str(notification_b.id)},
        }


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "senha-segura"},
    )
    assert response.status_code == 200


def _csrf_headers(client):
    csrf = client.get_cookie("lynk_csrf")
    assert csrf is not None
    return {"X-CSRF-Token": csrf.value}


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


def test_seller_cannot_open_lead_record_directly(client, seeded_data):
    _login(client, seeded_data["seller_a"])

    response = client.get(f"/api/v1/leads/{seeded_data['lead_a']['id']}")

    assert response.status_code == 403


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


def test_audit_logs_are_admin_only_and_organization_scoped(app, client, seeded_data):
    _login(client, seeded_data["seller_a"])
    forbidden_response = client.get("/api/v1/audit")
    assert forbidden_response.status_code == 403

    external_client = app.test_client()
    _login(external_client, seeded_data["admin_b"])
    external_response = external_client.get("/api/v1/audit?action=validate")
    assert external_response.status_code == 200, external_response.get_json()
    assert external_response.get_json()["total"] == 1
    assert external_response.get_json()["items"][0]["actor_user_id"] == seeded_data["admin_b"]["id"]

    admin_client = app.test_client()
    _login(admin_client, seeded_data["admin_a"])
    own_response = admin_client.get("/api/v1/audit?action=validate")
    assert own_response.status_code == 200
    assert own_response.get_json()["total"] == 1
    assert own_response.get_json()["items"][0]["entity_type"] == "sale"


def test_admin_configures_funnel_without_crossing_organization(app, seeded_data):
    seller_client = app.test_client()
    _login(seller_client, seeded_data["seller_a"])
    forbidden = seller_client.post(
        "/api/v1/admin/funnels",
        json={"product_id": seeded_data["product_a"]["id"], "name": "Funil bloqueado"},
        headers=_csrf_headers(seller_client),
    )
    assert forbidden.status_code == 403

    admin_client = app.test_client()
    _login(admin_client, seeded_data["admin_a"])
    headers = _csrf_headers(admin_client)
    external_product = admin_client.post(
        "/api/v1/admin/funnels",
        json={"product_id": seeded_data["product_b"]["id"], "name": "Funil externo"},
        headers=headers,
    )
    assert external_product.status_code == 422

    created = admin_client.post(
        "/api/v1/admin/funnels",
        json={
            "product_id": seeded_data["product_a"]["id"],
            "name": "Funil renovação",
            "is_default": True,
        },
        headers=headers,
    )
    assert created.status_code == 201
    funnel_id = created.get_json()["id"]

    first_stage = admin_client.post(
        f"/api/v1/admin/funnels/{funnel_id}/stages",
        json={
            "name": "Contato",
            "order_index": 0,
            "is_initial": True,
            "message_template": "Olá {nome_cliente}",
        },
        headers=headers,
    )
    second_stage = admin_client.post(
        f"/api/v1/admin/funnels/{funnel_id}/stages",
        json={"name": "Cotação", "order_index": 1, "is_initial": True},
        headers=headers,
    )
    assert first_stage.status_code == 201
    assert second_stage.status_code == 201

    response = admin_client.get("/api/v1/admin/funnels")
    configured = next(item for item in response.get_json()["items"] if item["id"] == funnel_id)
    assert [stage["name"] for stage in configured["stages"]] == ["Contato", "Cotação"]
    assert [stage["is_initial"] for stage in configured["stages"]] == [False, True]

    with app.app_context():
        external_funnel = Funnel(
            organization_id=seeded_data["org_b"]["id"],
            product_id=seeded_data["product_b"]["id"],
            name="Funil externo",
        )
        db.session.add(external_funnel)
        db.session.commit()
        external_funnel_id = str(external_funnel.id)
    hidden = admin_client.patch(
        f"/api/v1/admin/funnels/{external_funnel_id}",
        json={"name": "Tentativa"},
        headers=headers,
    )
    assert hidden.status_code == 404


def test_admin_manages_configurable_activity_catalogs(app, seeded_data):
    admin_client = app.test_client()
    _login(admin_client, seeded_data["admin_a"])
    headers = _csrf_headers(admin_client)

    created = admin_client.post(
        "/api/v1/loss-reasons",
        json={"name": "Sem orçamento"},
        headers=headers,
    )
    assert created.status_code == 201
    reason_id = created.get_json()["id"]

    duplicate = admin_client.post(
        "/api/v1/loss-reasons",
        json={"name": "Sem orçamento"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    disabled = admin_client.patch(
        f"/api/v1/loss-reasons/{reason_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert disabled.status_code == 200
    assert disabled.get_json()["is_active"] is False
    assert admin_client.get("/api/v1/loss-reasons").get_json()["items"] == []
    inactive_items = admin_client.get(
        "/api/v1/loss-reasons?include_inactive=true"
    ).get_json()["items"]
    assert inactive_items[0]["is_active"] is False

    action_type = admin_client.post(
        "/api/v1/next-action-types",
        json={"name": "Enviar documentos"},
        headers=headers,
    )
    assert action_type.status_code == 201
    assert action_type.get_json()["slug"] == "enviar-documentos"


def test_user_cannot_read_or_mark_another_users_notification(client, seeded_data):
    _login(client, seeded_data["seller_a"])

    list_response = client.get("/api/v1/notifications")
    assert list_response.status_code == 200
    assert list_response.get_json()["items"] == []

    mark_response = client.post(
        f"/api/v1/notifications/{seeded_data['notification_b']['id']}/read",
        json={},
        headers=_csrf_headers(client),
    )
    assert mark_response.status_code == 404


def test_admin_cannot_transfer_workload_to_another_organization(client, seeded_data):
    _login(client, seeded_data["admin_a"])

    response = client.post(
        "/api/v1/admin/transfers",
        json={
            "from_user_id": seeded_data["seller_a"]["id"],
            "to_user_id": seeded_data["admin_b"]["id"],
            "include_schedules": False,
            "include_next_actions": False,
            "include_opportunities": False,
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_admin_cannot_grant_access_with_external_target_user(client, seeded_data):
    _login(client, seeded_data["admin_a"])

    response = client.post(
        "/api/v1/admin/grants",
        json={
            "user_id": seeded_data["seller_a"]["id"],
            "target_user_id": seeded_data["admin_b"]["id"],
            "permission": "funnel.work",
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


@pytest.mark.parametrize(
    ("field", "data_key"),
    [
        ("lead_id", "lead_external"),
        ("product_id", "product_b"),
        ("owner_user_id", "admin_b"),
        ("origin_id", "origin_external"),
    ],
)
def test_admin_cannot_create_schedule_with_external_relationship(
    client, seeded_data, field, data_key
):
    _login(client, seeded_data["admin_a"])
    payload = {
        "lead_id": seeded_data["lead_a"]["id"],
        "product_id": seeded_data["product_a"]["id"],
        "coverage_end_date": "2026-12-31",
    }
    payload[field] = seeded_data[data_key]["id"]

    response = client.post(
        "/api/v1/schedules",
        json=payload,
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_mutations_require_and_accept_csrf_token(client, seeded_data):
    _login(client, seeded_data["admin_a"])

    missing_token = client.post("/api/v1/notifications/read-all", json={})

    assert missing_token.status_code == 403
    assert missing_token.get_json()["error"]["code"] == "csrf_invalid"

    valid_token = client.post(
        "/api/v1/notifications/read-all",
        json={},
        headers=_csrf_headers(client),
    )
    assert valid_token.status_code == 204
