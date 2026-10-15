from datetime import date

import pytest
from sqlalchemy import select

from app.core.auth import hash_password
from app.core.time import now_utc
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.claims import services
from app.modules.claims.models import CLAIM_STATUS_COMPLETED, ClaimTask
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
    Team,
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
        team = Team(organization_id=organization.id, name="Sinistros")
        db.session.add_all([product, team])
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
        db.session.add_all([admin, seller, manager, external_admin])
        db.session.flush()

        db.session.add(
            PermissionGrant(
                organization_id=organization.id,
                user_id=manager.id,
                granted_by=admin.id,
                permission="claims.manage",
                scope={},
                reason="Equipe de sinistros",
            )
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
            "admin": {"email": admin.email},
            "seller": {"email": seller.email, "id": str(seller.id)},
            "manager": {"email": manager.email, "id": str(manager.id)},
            "external_admin": {"email": external_admin.email},
            "lead_id": str(linked_lead.id),
            "unlinked_lead_id": str(unlinked_lead.id),
            "external_lead_id": str(external_lead.id),
            "opportunity_id": str(opportunity.id),
            "team_id": str(team.id),
            "status_id": str(statuses[0].id),
            "completed_status_id": str(completed.id),
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
        "status_id": data["status_id"],
        "branch": "Auto",
        "insurer": "Seguradora de teste",
        "opened_on": "2026-10-16",
        "indemnified_amount": "1250.50",
        "parties": [{"role": "segurado", "name": "Pessoa de teste"}],
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
            responsible_user_id=claims_data["seller"]["id"],
        ),
    )
    assert created.status_code == 201
    claim_id = created.get_json()["id"]

    _logout(client)
    _login(client, claims_data["seller"])
    forbidden = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(claims_data),
    )
    assert forbidden.status_code == 403
    assert client.get(f"/api/v1/claims/{claim_id}").status_code == 404


def test_claims_manager_operates_assignment_status_timeline_tasks_and_archive(
    app, client, claims_data
):
    _login(client, claims_data["manager"])
    assignees = client.get("/api/v1/claims/assignees")
    assert assignees.status_code == 200
    assert claims_data["manager"]["id"] in {
        user["id"] for user in assignees.get_json()["users"]
    }
    assert claims_data["team_id"] in {
        team["id"] for team in assignees.get_json()["teams"]
    }
    created = client.post(
        "/api/v1/claims",
        headers=_csrf_headers(client),
        json=_claim_payload(claims_data, claim_number="SIN-100"),
    )
    assert created.status_code == 201, created.get_json()
    assert created.get_json()["indemnified_amount"] == "1250.50"
    claim_id = created.get_json()["id"]

    assigned = client.post(
        f"/api/v1/claims/{claim_id}/assign",
        headers=_csrf_headers(client),
        json={
            "responsible_user_id": claims_data["manager"]["id"],
            "team_id": claims_data["team_id"],
        },
    )
    assert assigned.status_code == 200
    assert assigned.get_json()["team_id"] == claims_data["team_id"]

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
        json=_claim_payload(claims_data, expected_on="2026-10-15"),
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


def test_claims_list_supports_search_status_and_pagination(client, claims_data):
    _login(client, claims_data["admin"])
    headers = _csrf_headers(client)
    for claim_number, insurer in (
        ("SEARCH-001", "Seguradora Alfa"),
        ("SEARCH-002", "Seguradora Alfa"),
        ("OTHER-001", "Seguradora Beta"),
    ):
        created = client.post(
            "/api/v1/claims",
            headers=headers,
            json=_claim_payload(
                claims_data,
                claim_number=claim_number,
                insurer=insurer,
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
