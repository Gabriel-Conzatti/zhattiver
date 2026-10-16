from datetime import date

import pytest
from sqlalchemy import select

from app.core.auth import hash_password
from app.core.time import now_utc
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.catalog.models import Insurer
from app.modules.claims import services
from app.modules.claims.models import (
    CLAIM_STATUS_COMPLETED,
    ITEM_TYPE_PROPERTY,
    ITEM_TYPE_VEHICLE,
    ClaimBranch,
    ClaimTask,
)
from app.modules.funnel.models import Funnel, FunnelStage
from app.modules.leads.models import Lead
from app.modules.opportunities.models import STATE_OPEN, Opportunity
from app.modules.orgs.models import Organization
from app.modules.users.models import (
    ROLE_ADMIN,
    ROLE_SDR,
    ROLE_VENDEDOR,
    PermissionGrant,
    Product,
    User,
)


@pytest.fixture()
def claims_data(app):
    with app.app_context():
        organization = Organization(name="Claims Org", slug="claims-org")
        external_organization = Organization(name="External Org", slug="claims-external")
        db.session.add_all([organization, external_organization])
        db.session.flush()

        product = Product(organization_id=organization.id, name="Auto", slug="auto")
        branch = ClaimBranch(
            organization_id=organization.id,
            name="Auto",
            item_type=ITEM_TYPE_VEHICLE,
            is_active=True,
        )
        property_branch = ClaimBranch(
            organization_id=organization.id,
            name="RE",
            item_type=ITEM_TYPE_PROPERTY,
            is_active=True,
        )
        external_insurer = Insurer(
            organization_id=external_organization.id,
            name="Seguradora externa",
            is_active=True,
        )
        insurer = Insurer(
            organization_id=organization.id,
            name="Allianz",
            is_active=True,
        )
        insurer_alpha = Insurer(
            organization_id=organization.id,
            name="Seguradora Alfa",
            is_active=True,
        )
        insurer_beta = Insurer(
            organization_id=organization.id,
            name="Seguradora Beta",
            is_active=True,
        )
        db.session.add_all(
            [
                product,
                branch,
                property_branch,
                insurer,
                insurer_alpha,
                insurer_beta,
                external_insurer,
            ]
        )
        db.session.flush()

        admin = User(
            organization_id=organization.id,
            email="claims-admin@example.com",
            name="Claims Admin",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        seller = User(
            organization_id=organization.id,
            email="claims-seller@example.com",
            name="Claims Seller",
            password_hash=hash_password("senha-segura"),
            role=ROLE_VENDEDOR,
        )
        seller_without_claims = User(
            organization_id=organization.id,
            email="claims-no-access@example.com",
            name="Seller sem sinistros",
            password_hash=hash_password("senha-segura"),
            role=ROLE_VENDEDOR,
        )
        manager = User(
            organization_id=organization.id,
            email="claims-manager@example.com",
            name="Claims Manager",
            password_hash=hash_password("senha-segura"),
            role=ROLE_SDR,
        )
        external_admin = User(
            organization_id=external_organization.id,
            email="claims-external@example.com",
            name="External Admin",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        seller.products.append(product)
        db.session.add_all(
            [admin, seller, seller_without_claims, manager, external_admin]
        )
        db.session.flush()

        db.session.add_all(
            [
                PermissionGrant(
                    organization_id=organization.id,
                    user_id=seller.id,
                    granted_by=admin.id,
                    permission="claims.read",
                    scope={},
                    reason="Vendedor também consulta sinistros",
                ),
                PermissionGrant(
                organization_id=organization.id,
                user_id=manager.id,
                granted_by=admin.id,
                permission="claims.manage",
                scope={},
                reason="Equipe de sinistros",
                ),
            ]
        )
        linked_lead = Lead(organization_id=organization.id, name="Cliente vinculado")
        unlinked_lead = Lead(organization_id=organization.id, name="Cliente não vinculado")
        external_lead = Lead(
            organization_id=external_organization.id,
            name="Cliente externo",
        )
        db.session.add_all([linked_lead, unlinked_lead, external_lead])
        db.session.flush()

        funnel = Funnel(
            organization_id=organization.id,
            product_id=product.id,
            name="Funil Auto",
            is_default=True,
        )
        db.session.add(funnel)
        db.session.flush()
        stage = FunnelStage(
            organization_id=organization.id,
            funnel_id=funnel.id,
            name="Inicial",
            order_index=0,
            is_initial=True,
        )
        db.session.add(stage)
        db.session.flush()
        opportunity = Opportunity(
            organization_id=organization.id,
            lead_id=linked_lead.id,
            product_id=product.id,
            funnel_id=funnel.id,
            current_stage_id=stage.id,
            owner_user_id=seller.id,
            state=STATE_OPEN,
            opened_at=now_utc(),
            last_relevant_at=now_utc(),
        )
        db.session.add(opportunity)

        statuses = services.ensure_default_statuses(organization.id)
        services.ensure_default_statuses(external_organization.id)
        db.session.commit()
        completed = next(status for status in statuses if status.slug == CLAIM_STATUS_COMPLETED)
        return {
            "organization_id": str(organization.id),
            "admin": {"email": admin.email, "id": str(admin.id)},
            "seller": {"email": seller.email, "id": str(seller.id)},
            "seller_without_claims": {
                "email": seller_without_claims.email,
                "id": str(seller_without_claims.id),
            },
            "manager": {"email": manager.email, "id": str(manager.id)},
            "external_admin": {"email": external_admin.email, "id": str(external_admin.id)},
            "lead_id": str(linked_lead.id),
            "unlinked_lead_id": str(unlinked_lead.id),
            "external_lead_id": str(external_lead.id),
            "opportunity_id": str(opportunity.id),
            "status_id": str(statuses[0].id),
            "completed_status_id": str(completed.id),
            "branch_id": str(branch.id),
            "property_branch_id": str(property_branch.id),
            "insurer_id": str(insurer.id),
            "external_insurer_id": str(external_insurer.id),
            "insurer_alpha_id": str(insurer_alpha.id),
            "insurer_beta_id": str(insurer_beta.id),
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


def _logout(client):
    response = client.post("/api/v1/auth/logout", headers=_csrf_headers(client))
    assert response.status_code == 204


def _claim_payload(data, **overrides):
    payload = {
        "branch_id": data["branch_id"],
        "insurer_id": data["insurer_id"],
        "opened_on": "2026-10-16",
        "indemnified_amount": "1250.50",
        "service_type": "segurado",
        "responsible_user_id": data["admin"]["id"],
        "vehicle_plate": "abc-1d23",
        "vehicle_model": "Onix",
        "vehicle_year": 2022,
        "parties": [
            {
                "role": "segurado",
                "name": "Pessoa de teste",
                "document": "123.456.789-09",
                "phone": "(51) 99999-0000",
            }
        ],
    }
    payload.update(overrides)
    return payload


def test_admin_creates_claim_and_seller_reads_only_commercially_linked_claim(
    client, claims_data
):
    _login(client, claims_data["admin"])
    linked = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(
            claims_data,
            lead_id=claims_data["lead_id"],
            opportunity_id=claims_data["opportunity_id"],
        ),
    )
    assert linked.status_code == 201, linked.get_json()
    linked_id = linked.get_json()["id"]

    unlinked = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(
            claims_data,
            lead_id=claims_data["unlinked_lead_id"],
            claim_number="UNLINKED",
        ),
    )
    assert unlinked.status_code == 201, unlinked.get_json()

    _logout(client)
    _login(client, claims_data["seller"])
    visible = client.get("/api/v1/claims?per_page=10")
    assert visible.status_code == 200
    assert visible.get_json()["total"] == 1
    assert [item["id"] for item in visible.get_json()["items"]] == [linked_id]
    assert visible.get_json()["items"][0]["indemnified_amount"] is None
    detail = client.get(f"/api/v1/claims/{linked_id}")
    assert detail.status_code == 200
    assert detail.get_json()["indemnified_amount"] is None
    assert client.get(f"/api/v1/claims/{unlinked.get_json()['id']}").status_code == 404


def test_seller_cannot_create_or_read_claim_by_assignment_only(client, claims_data):
    _login(client, claims_data["admin"])
    created = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(
            claims_data,
            responsible_user_id=claims_data["seller_without_claims"]["id"],
        ),
    )
    assert created.status_code == 422
    assert created.get_json()["error"]["code"] == "invalid_claim_assignee"

    _logout(client)
    _login(client, claims_data["seller_without_claims"])
    forbidden = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(claims_data),
    )
    assert forbidden.status_code == 403
    assert client.get("/api/v1/claims").status_code == 403


def test_claims_manager_operates_assignment_status_timeline_tasks_and_archive(
    app, client, claims_data
):
    _login(client, claims_data["manager"])
    assignees = client.get("/api/v1/claims/assignees")
    assert assignees.status_code == 200
    assert claims_data["manager"]["id"] in {
        user["id"] for user in assignees.get_json()["users"]
    }
    assert claims_data["seller"]["id"] not in {
        user["id"] for user in assignees.get_json()["users"]
    }
    assert claims_data["seller_without_claims"]["id"] not in {
        user["id"] for user in assignees.get_json()["users"]
    }
    assert "teams" not in assignees.get_json()
    created = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(claims_data, claim_number="SIN-100"),
    )
    assert created.status_code == 201, created.get_json()
    assert created.get_json()["indemnified_amount"] == "1250.50"
    assert created.get_json()["vehicle_plate"] == "ABC1D23"
    assert created.get_json()["status"] == "em_acompanhamento"
    insured = created.get_json()["parties"][0]
    assert insured["document"] == "12345678909"
    assert insured["phone"] == "+5551999990000"
    claim_id = created.get_json()["id"]

    assigned = client.post(
        f"/api/v1/claims/{claim_id}/assign",
        headers=_csrf_headers(client),
        json={"responsible_user_id": claims_data["manager"]["id"]},
    )
    assert assigned.status_code == 200
    assert assigned.get_json()["responsible_user_id"] == claims_data["manager"]["id"]

    event = client.post(
        f"/api/v1/claims/{claim_id}/events",
        headers=_csrf_headers(client),
        json={"description": "Contato realizado com a seguradora"},
    )
    assert event.status_code == 200

    task = client.post(
        f"/api/v1/claims/{claim_id}/tasks",
        headers=_csrf_headers(client),
        json={"title": "Cobrar retorno", "due_on": "2026-10-20", "priority": "high"},
    )
    assert task.status_code == 201
    task_id = task.get_json()["id"]
    completed_task = client.patch(
        f"/api/v1/claims/{claim_id}/tasks/{task_id}",
        headers=_csrf_headers(client),
        json={"done": True},
    )
    assert completed_task.status_code == 200
    assert completed_task.get_json()["tasks"][0]["done_at"] is not None

    status = client.post(
        f"/api/v1/claims/{claim_id}/status",
        headers=_csrf_headers(client),
        json={"status_id": claims_data["completed_status_id"]},
    )
    assert status.status_code == 200
    assert status.get_json()["concluded_on"] == date.today().isoformat()
    assert len(status.get_json()["events"]) >= 5

    archived = client.post(
        f"/api/v1/claims/{claim_id}/archive",
        headers=_csrf_headers(client),
        json={"reason": "Registro de teste concluído"},
    )
    assert archived.status_code == 204
    assert client.get(f"/api/v1/claims/{claim_id}").status_code == 404

    with app.app_context():
        assert db.session.scalar(select(ClaimTask).where(ClaimTask.id == task_id)).done_at
        actions = set(
            db.session.scalars(
                select(AuditLog.action).where(
                    AuditLog.organization_id == claims_data["organization_id"],
                    AuditLog.entity_id.in_([claim_id, task_id]),
                )
            )
        )
        assert {"create", "assign", "status_change", "archive", "complete"} <= actions


def test_claims_reject_cross_tenant_links_invalid_dates_and_negative_amount(
    client, claims_data
):
    _login(client, claims_data["admin"])
    headers = _csrf_headers(client)

    external = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, lead_id=claims_data["external_lead_id"]),
    )
    assert external.status_code == 422
    assert external.get_json()["error"]["code"] == "invalid_link"

    invalid_date = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, concluded_on="2026-10-15"),
    )
    assert invalid_date.status_code == 422
    assert invalid_date.get_json()["error"]["code"] == "invalid_date"

    negative = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, indemnified_amount="-1"),
    )
    assert negative.status_code == 422


def test_admin_configures_claim_status_without_mutating_get(client, claims_data):
    _login(client, claims_data["admin"])
    before = client.get("/api/v1/claims/statuses")
    assert before.status_code == 200
    assert len(before.get_json()["items"]) == 6

    created = client.post(
        "/api/v1/claims/statuses",
        headers=_csrf_headers(client),
        json={
            "name": "Em análise documental",
            "slug": "analise_documental",
            "sort_order": 2,
            "is_terminal": False,
        },
    )
    assert created.status_code == 201
    status_id = created.get_json()["id"]
    updated = client.patch(
        f"/api/v1/claims/statuses/{status_id}",
        headers=_csrf_headers(client),
        json={"name": "Análise documental", "is_active": False},
    )
    assert updated.status_code == 200
    after = client.get("/api/v1/claims/statuses")
    assert len(after.get_json()["items"]) == 6

    duplicate = client.post(
        "/api/v1/claims/statuses",
        headers=_csrf_headers(client),
        json={
            "name": "Duplicado",
            "slug": "em_acompanhamento",
            "sort_order": 0,
            "is_terminal": False,
        },
    )
    assert duplicate.status_code == 409


def test_claims_manager_registers_workshop_and_links_it_to_claim(
    client, claims_data
):
    _login(client, claims_data["manager"])
    headers = _csrf_headers(client)

    created_workshop = client.post(
        "/api/v1/claims/workshops",
        headers=headers,
        json={
            "name": "Oficina Referenciada",
            "phone": "(11) 3333-4444",
            "address": "Rua de Teste, 100 - São Paulo/SP",
            "responsible_name": "Responsável de Teste",
            "insurer_ids": [claims_data["insurer_id"]],
        },
    )
    assert created_workshop.status_code == 201, created_workshop.get_json()
    workshop = created_workshop.get_json()

    catalogs = client.get("/api/v1/claims/catalogs")
    assert catalogs.status_code == 200
    assert {
        (item["name"], item["item_type"]) for item in catalogs.get_json()["branches"]
    } == {("Auto", "vehicle"), ("RE", "property")}
    assert workshop["id"] in {
        item["id"] for item in catalogs.get_json()["workshops"]
    }

    claim = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, workshop_id=workshop["id"]),
    )
    assert claim.status_code == 201, claim.get_json()
    assert claim.get_json()["workshop_id"] == workshop["id"]
    assert claim.get_json()["workshop"] == "Oficina Referenciada"

    incompatible = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(
            claims_data,
            insurer_id=claims_data["insurer_alpha_id"],
            workshop_id=workshop["id"],
        ),
    )
    assert incompatible.status_code == 422
    assert incompatible.get_json()["error"]["code"] == "workshop_insurer_mismatch"

    archived = client.post(
        f"/api/v1/claims/workshops/{workshop['id']}/archive",
        headers=headers,
    )
    assert archived.status_code == 204
    catalogs_after = client.get("/api/v1/claims/catalogs")
    assert workshop["id"] not in {
        item["id"] for item in catalogs_after.get_json()["workshops"]
    }


def test_claim_task_cannot_be_assigned_to_user_from_another_organization(
    client, claims_data
):
    _login(client, claims_data["manager"])
    headers = _csrf_headers(client)
    created = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data),
    )
    assert created.status_code == 201

    response = client.post(
        f"/api/v1/claims/{created.get_json()['id']}/tasks",
        headers=headers,
        json={
            "title": "Tarefa inválida",
            "owner_user_id": claims_data["external_admin"]["id"],
        },
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "invalid_link"


def test_claims_list_supports_search_status_and_pagination(client, claims_data):
    _login(client, claims_data["admin"])
    headers = _csrf_headers(client)
    for claim_number, insurer_id in (
        ("SEARCH-001", claims_data["insurer_alpha_id"]),
        ("SEARCH-002", claims_data["insurer_alpha_id"]),
        ("OTHER-001", claims_data["insurer_beta_id"]),
    ):
        created = client.post(
            "/api/v1/claims",
            headers=headers,
            json=_claim_payload(
                claims_data,
                claim_number=claim_number,
                insurer_id=insurer_id,
            ),
        )
        assert created.status_code == 201

    first_page = client.get("/api/v1/claims?q=seguradora%20alfa&page=1&per_page=1")
    assert first_page.status_code == 200
    assert first_page.get_json()["total"] == 2
    assert len(first_page.get_json()["items"]) == 1

    second_page = client.get("/api/v1/claims?q=SEARCH&page=2&per_page=1")
    assert second_page.status_code == 200
    assert second_page.get_json()["total"] == 2
    assert len(second_page.get_json()["items"]) == 1
    assert second_page.get_json()["items"][0]["id"] != first_page.get_json()["items"][0]["id"]

    by_status = client.get("/api/v1/claims?status=em_acompanhamento&per_page=10")
    assert by_status.status_code == 200
    assert by_status.get_json()["total"] == 3


def test_claim_opening_requires_insured_item_and_service_data(client, claims_data):
    _login(client, claims_data["admin"])
    headers = _csrf_headers(client)

    without_document = _claim_payload(claims_data)
    without_document["parties"] = [
        {"role": "segurado", "name": "Sem CPF", "phone": "(51) 99999-0000"}
    ]
    response = client.post("/api/v1/claims", headers=headers, json=without_document)
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "missing_insured"

    response = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, vehicle_plate=None),
    )
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "missing_item"

    response = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, service_type="apenas_vidros"),
    )
    assert response.status_code == 422

    response = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, responsible_user_id=None),
    )
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "missing_responsible"

    property_claim = _claim_payload(
        claims_data,
        branch_id=claims_data["property_branch_id"],
        vehicle_plate=None,
        vehicle_model=None,
        vehicle_year=None,
        property_address="Rua das Flores, 10 - Porto Alegre/RS",
    )
    response = client.post("/api/v1/claims", headers=headers, json=property_claim)
    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "missing_item"

    property_claim["coverage"] = "Vendaval"
    property_claim["service_type"] = "segurado_terceiro"
    property_claim["parties"].append(
        {"role": "terceiro", "name": "Vizinho", "phone": "(51) 98888-0000"}
    )
    response = client.post("/api/v1/claims", headers=headers, json=property_claim)
    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body["coverage"] == "Vendaval"
    assert body["has_third_party"] is True
    assert {party["role"] for party in body["parties"]} == {"segurado", "terceiro"}


def test_claims_list_splits_open_and_closed_with_summary(client, claims_data):
    _login(client, claims_data["admin"])
    headers = _csrf_headers(client)
    open_claim = client.post(
        "/api/v1/claims", headers=headers, json=_claim_payload(claims_data)
    ).get_json()
    closed_claim = client.post(
        "/api/v1/claims",
        headers=headers,
        json=_claim_payload(claims_data, claim_number="FECHADO-1"),
    ).get_json()
    client.post(
        f"/api/v1/claims/{closed_claim['id']}/status",
        headers=headers,
        json={"status_id": claims_data["completed_status_id"]},
    )
    for due_on in ("2026-11-20", "2026-11-05"):
        client.post(
            f"/api/v1/claims/{open_claim['id']}/tasks",
            headers=headers,
            json={"title": "Cobrar seguradora", "due_on": due_on},
        )

    opened = client.get("/api/v1/claims?state=open").get_json()
    assert [item["id"] for item in opened["items"]] == [open_claim["id"]]
    assert opened["items"][0]["insured_name"] == "Pessoa de teste"
    assert opened["items"][0]["next_follow_up_on"] == "2026-11-05"
    assert opened["items"][0]["is_closed"] is False

    closed = client.get("/api/v1/claims?state=closed").get_json()
    assert [item["id"] for item in closed["items"]] == [closed_claim["id"]]
    assert closed["items"][0]["is_closed"] is True

    by_insured = client.get("/api/v1/claims?q=pessoa%20de").get_json()
    assert by_insured["total"] == 2
    assert client.get("/api/v1/claims?state=qualquer").status_code == 422


def test_claims_dashboard_counts_open_claims_and_follow_ups_of_the_day(
    client, claims_data
):
    from app.core.time import today_local

    _login(client, claims_data["manager"])
    headers = _csrf_headers(client)
    claim = client.post(
        "/api/v1/claims", headers=headers, json=_claim_payload(claims_data)
    ).get_json()
    today = today_local()
    for title, due_on in (
        ("Ligar para o segurado", today.isoformat()),
        ("Pendência atrasada", date(today.year - 1, 1, 2).isoformat()),
        ("Retorno futuro", date(today.year + 1, 1, 2).isoformat()),
    ):
        client.post(
            f"/api/v1/claims/{claim['id']}/tasks",
            headers=headers,
            json={"title": title, "due_on": due_on},
        )

    dashboard = client.get("/api/v1/claims/dashboard")
    assert dashboard.status_code == 200
    body = dashboard.get_json()
    assert body["open_count"] == 1
    assert body["today_count"] == 1
    assert [item["title"] for item in body["items"]] == [
        "Pendência atrasada",
        "Ligar para o segurado",
    ]
    assert body["items"][0]["overdue"] is True
    assert body["items"][1]["insured_name"] == "Pessoa de teste"

    _logout(client)
    _login(client, claims_data["seller_without_claims"])
    assert client.get("/api/v1/claims/dashboard").status_code == 403


def test_claim_history_accepts_and_adjusts_update_date(client, claims_data):
    _login(client, claims_data["manager"])
    headers = _csrf_headers(client)
    claim = client.post(
        "/api/v1/claims", headers=headers, json=_claim_payload(claims_data)
    ).get_json()

    created = client.post(
        f"/api/v1/claims/{claim['id']}/events",
        headers=headers,
        json={
            "description": "Seguradora retornou por telefone",
            "occurred_at": "2026-10-10T09:30:00-03:00",
        },
    )
    assert created.status_code == 200
    note = next(event for event in created.get_json()["events"] if event["editable"])
    assert note["occurred_at"].startswith("2026-10-10T12:30:00")

    adjusted = client.patch(
        f"/api/v1/claims/{claim['id']}/events/{note['id']}",
        headers=headers,
        json={"occurred_at": "2026-10-11T14:00:00"},
    )
    assert adjusted.status_code == 200
    adjusted_note = next(
        event for event in adjusted.get_json()["events"] if event["id"] == note["id"]
    )
    assert adjusted_note["occurred_at"].startswith("2026-10-11T17:00:00")

    future = client.patch(
        f"/api/v1/claims/{claim['id']}/events/{note['id']}",
        headers=headers,
        json={"occurred_at": "2999-01-01T10:00:00-03:00"},
    )
    assert future.status_code == 422
    assert future.get_json()["error"]["code"] == "invalid_event_date"

    system_event = next(
        event for event in created.get_json()["events"] if not event["editable"]
    )
    locked = client.patch(
        f"/api/v1/claims/{claim['id']}/events/{system_event['id']}",
        headers=headers,
        json={"occurred_at": "2026-10-11T14:00:00-03:00"},
    )
    assert locked.status_code == 409


def test_insurer_profiles_are_read_by_claims_users_and_edited_by_managers(
    client, claims_data
):
    _login(client, claims_data["manager"])
    headers = _csrf_headers(client)
    saved = client.put(
        f"/api/v1/claims/insurers/{claims_data['insurer_id']}/profile",
        headers=headers,
        json={
            "contacts": "Central 24h: 0800 000 0000",
            "rental_car_contact": "Carro reserva: 0800 111 1111",
            "notes": "Consultar franquia no portal do corretor.",
        },
    )
    assert saved.status_code == 200, saved.get_json()
    assert saved.get_json()["rental_car_contact"] == "Carro reserva: 0800 111 1111"
    assert (
        client.put(
            f"/api/v1/claims/insurers/{claims_data['external_insurer_id']}/profile",
            headers=headers,
            json={"contacts": "Outra organização"},
        ).status_code
        == 422
    )

    _logout(client)
    _login(client, claims_data["seller"])
    listed = client.get("/api/v1/claims/insurers")
    assert listed.status_code == 200
    allianz = next(
        item
        for item in listed.get_json()["items"]
        if item["insurer_id"] == claims_data["insurer_id"]
    )
    assert allianz["contacts"] == "Central 24h: 0800 000 0000"
    assert claims_data["external_insurer_id"] not in {
        item["insurer_id"] for item in listed.get_json()["items"]
    }
    forbidden = client.put(
        f"/api/v1/claims/insurers/{claims_data['insurer_id']}/profile",
        headers=_csrf_headers(client),
        json={"notes": "Sem permissão"},
    )
    assert forbidden.status_code == 403
