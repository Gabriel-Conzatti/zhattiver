import pytest
from sqlalchemy import func, select

from app.core.auth import hash_password
from app.core.time import now_utc
from app.extensions import db
from app.modules.funnel.models import Funnel, FunnelStage
from app.modules.leads.models import Lead
from app.modules.notifications.models import Notification
from app.modules.opportunities.models import STATE_OPEN, Opportunity
from app.modules.orgs.models import Organization
from app.modules.users.models import ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR, Product, User


@pytest.fixture()
def org_data(app):
    with app.app_context():
        organization = Organization(name="Prospecção Org", slug="prospeccao-org")
        db.session.add(organization)
        db.session.flush()
        product = Product(organization_id=organization.id, name="Auto", slug="auto")
        db.session.add(product)
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
        users = {}
        for role in (ROLE_ADMIN, ROLE_SDR, ROLE_VENDEDOR):
            user = User(
                organization_id=organization.id,
                email=f"{role}@prospeccao.example.com",
                name=f"Usuário {role}",
                password_hash=hash_password("senha-segura"),
                role=role,
            )
            if role != ROLE_ADMIN:
                user.products.append(product)
            db.session.add(user)
            users[role] = user
        db.session.commit()
        return {
            "organization_id": str(organization.id),
            "product_id": str(product.id),
            "funnel_id": str(funnel.id),
            "stage_id": str(stage.id),
            **{role: {"email": user.email, "id": str(user.id)} for role, user in users.items()},
        }


def _login(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "senha-segura"},
    )
    assert response.status_code == 200


def _headers(client):
    return {"X-CSRF-Token": client.get_cookie("lynk_csrf").value}


def _logout(client):
    assert client.post("/api/v1/auth/logout", headers=_headers(client)).status_code == 204


def _create_lead(client, name, phone, **extra):
    response = client.post(
        "/api/v1/leads",
        headers=_headers(client),
        json={"name": name, "phones": [phone], **extra},
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def test_lead_postal_code_is_optional_and_normalized(client, org_data):
    _login(client, org_data["sdr"])
    without_cep = _create_lead(client, "Sem CEP", "(51) 99100-0001")
    assert without_cep["postal_code"] is None
    with_cep = _create_lead(client, "Com CEP", "(51) 99100-0002", postal_code="90010000")
    assert with_cep["postal_code"] == "90010-000"

    invalid = client.post(
        "/api/v1/leads",
        headers=_headers(client),
        json={"name": "CEP ruim", "phones": ["(51) 99100-0003"], "postal_code": "123"},
    )
    assert invalid.status_code == 422
    assert invalid.get_json()["error"]["code"] == "invalid_postal_code"


def test_sdr_edits_lead_profile_and_phone_duplicates_are_blocked(client, org_data):
    _login(client, org_data["sdr"])
    first = _create_lead(client, "Cliente A", "(51) 99200-0001")
    _create_lead(client, "Cliente B", "(51) 99200-0002")

    updated = client.patch(
        f"/api/v1/leads/{first['id']}",
        headers=_headers(client),
        json={
            "name": "Cliente A Silva",
            "phones": ["(51) 99200-0009", "(51) 3333-0000"],
            "postal_code": "90010-000",
            "city": "Porto Alegre",
            "state": "rs",
        },
    )
    assert updated.status_code == 200, updated.get_json()
    body = updated.get_json()
    assert body["name"] == "Cliente A Silva"
    assert body["state"] == "RS"
    assert body["postal_code"] == "90010-000"
    assert [phone["phone_e164"] for phone in body["phones"]] == [
        "+5551992000009",
        "+555133330000",
    ]

    duplicate = client.patch(
        f"/api/v1/leads/{first['id']}",
        headers=_headers(client),
        json={"phones": ["(51) 99200-0002"]},
    )
    assert duplicate.status_code == 409
    assert duplicate.get_json()["error"]["details"]["lead_name"] == "Cliente B"


def test_released_lead_shows_status_for_sdr_and_reaches_seller(app, client, org_data):
    _login(client, org_data["sdr"])
    lead = _create_lead(client, "Lead disponível", "(51) 99300-0001")
    other = _create_lead(client, "Lead disponível 2", "(51) 99300-0002")
    for item in (lead, other):
        released = client.post(
            "/api/v1/availabilities",
            headers=_headers(client),
            json={"lead_id": item["id"], "product_id": org_data["product_id"]},
        )
        assert released.status_code == 201

    listed = {item["id"]: item for item in client.get("/api/v1/leads").get_json()["items"]}
    assert listed[lead["id"]]["released"] is True

    with app.app_context():
        notifications = db.session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == org_data["admin"]["id"],
                Notification.kind == "lead_released",
            )
        )
        assert notifications == 2

    _logout(client)
    _login(client, org_data["vendedor"])
    available = client.get("/api/v1/availabilities").get_json()["items"]
    assert {item["lead_id"] for item in available} == {lead["id"], other["id"]}


def test_lead_deletion_goes_to_admin_review(app, client, org_data):
    _login(client, org_data["sdr"])
    lead = _create_lead(client, "Excluir depois", "(51) 99400-0001")
    kept = _create_lead(client, "Excluir e restaurar", "(51) 99400-0002")
    for item in (lead, kept):
        response = client.post(
            f"/api/v1/leads/{item['id']}/deletion-request",
            headers=_headers(client),
            json={"reason": "Contato inválido"},
        )
        assert response.status_code == 201
    assert client.get("/api/v1/lead-deletion-requests").status_code == 403
    assert {item["id"] for item in client.get("/api/v1/leads").get_json()["items"]} == set()

    _logout(client)
    _login(client, org_data["admin"])
    pending = client.get("/api/v1/lead-deletion-requests").get_json()["items"]
    assert {item["lead_name"] for item in pending} == {"Excluir depois", "Excluir e restaurar"}
    by_lead = {item["lead_id"]: item for item in pending}
    assert by_lead[lead["id"]]["requested_by_name"] == "Usuário sdr"

    approved = client.post(
        f"/api/v1/lead-deletion-requests/{by_lead[lead['id']]['id']}/approve",
        headers=_headers(client),
    )
    assert approved.status_code == 200
    rejected = client.post(
        f"/api/v1/lead-deletion-requests/{by_lead[kept['id']]['id']}/reject",
        headers=_headers(client),
    )
    assert rejected.status_code == 200
    again = client.post(
        f"/api/v1/lead-deletion-requests/{by_lead[kept['id']]['id']}/approve",
        headers=_headers(client),
    )
    assert again.status_code == 409
    assert client.get("/api/v1/lead-deletion-requests").get_json()["items"] == []

    with app.app_context():
        assert db.session.get(Lead, lead["id"]).archived_at is not None
        assert db.session.get(Lead, kept["id"]).archived_at is None


def test_lead_in_funnel_cannot_be_deleted(app, client, org_data):
    _login(client, org_data["sdr"])
    lead = _create_lead(client, "Em atendimento", "(51) 99500-0001")
    with app.app_context():
        db.session.add(
            Opportunity(
                organization_id=org_data["organization_id"],
                lead_id=lead["id"],
                product_id=org_data["product_id"],
                funnel_id=org_data["funnel_id"],
                current_stage_id=org_data["stage_id"],
                owner_user_id=org_data["vendedor"]["id"],
                state=STATE_OPEN,
                opened_at=now_utc(),
                last_relevant_at=now_utc(),
            )
        )
        db.session.commit()
    response = client.post(
        f"/api/v1/leads/{lead['id']}/deletion-request", headers=_headers(client), json={}
    )
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "lead_in_use"


def _upload(client, content: str, filename="leads.csv"):
    from io import BytesIO

    response = client.post(
        "/api/v1/imports/leads",
        headers=_headers(client),
        data={"file": (BytesIO(content.encode("utf-8")), filename)},
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["id"]


def test_import_can_be_discarded_during_review(client, org_data):
    _login(client, org_data["sdr"])
    batch_id = _upload(client, "nome;telefone\nDescartado;51996000001\n")

    discarded = client.post(f"/api/v1/imports/{batch_id}/discard", headers=_headers(client))
    assert discarded.status_code == 200
    assert discarded.get_json()["status"] == "discarded"
    confirm = client.post(f"/api/v1/imports/{batch_id}/confirm", headers=_headers(client))
    assert confirm.status_code == 409
    assert client.get("/api/v1/leads").get_json()["total"] == 0


def test_confirmed_import_links_rows_to_leads_for_individual_deletion(client, org_data):
    _login(client, org_data["sdr"])
    batch_id = _upload(
        client,
        "nome;telefone;cep\nImportado A;51997000001;90010-000\n"
        "Importado B;51997000002;\nCEP ruim;51997000003;123\n",
    )
    confirmed = client.post(f"/api/v1/imports/{batch_id}/confirm", headers=_headers(client))
    assert confirmed.get_json()["created"] == 2
    assert (
        client.post(f"/api/v1/imports/{batch_id}/discard", headers=_headers(client)).status_code
        == 409
    )

    rows = client.get(f"/api/v1/imports/{batch_id}").get_json()["rows"]
    created_rows = [row for row in rows if row["lead_id"]]
    assert len(created_rows) == 2
    assert {row["lead_state"] for row in created_rows} == {"active"}
    assert next(row for row in rows if row["status"] == "error")["errors"] == [
        "CEP deve ter 8 dígitos"
    ]

    target = created_rows[0]
    deletion = client.post(
        f"/api/v1/leads/{target['lead_id']}/deletion-request",
        headers=_headers(client),
        json={},
    )
    assert deletion.status_code == 201
    rows = client.get(f"/api/v1/imports/{batch_id}").get_json()["rows"]
    states = {row["lead_id"]: row["lead_state"] for row in rows if row["lead_id"]}
    assert states[target["lead_id"]] == "deletion_pending"

    _logout(client)
    _login(client, org_data["admin"])
    pending = client.get("/api/v1/lead-deletion-requests").get_json()["items"]
    assert pending[0]["import_batch_id"] == batch_id


def test_schedule_from_scratch_creates_lead_and_rejects_known_phone(client, org_data):
    _login(client, org_data["sdr"])
    existing = _create_lead(client, "Já cadastrado", "(51) 99800-0001")
    payload = {
        "product_id": org_data["product_id"],
        "coverage_end_date": "2026-12-20",
        "new_lead": {
            "name": "Cliente novo",
            "phone": "(51) 99800-0002",
            "postal_code": "90010000",
        },
    }
    created = client.post("/api/v1/schedules", headers=_headers(client), json=payload)
    assert created.status_code == 201, created.get_json()
    assert created.get_json()["lead_name"] == "Cliente novo"
    lead = client.get(f"/api/v1/leads/{created.get_json()['lead_id']}").get_json()
    assert lead["postal_code"] == "90010-000"

    payload["new_lead"] = {"name": "Outro nome", "phone": "51 99800-0001"}
    duplicate = client.post("/api/v1/schedules", headers=_headers(client), json=payload)
    assert duplicate.status_code == 409
    assert duplicate.get_json()["error"]["details"]["lead_id"] == existing["id"]

    both = client.post(
        "/api/v1/schedules",
        headers=_headers(client),
        json={**payload, "lead_id": existing["id"]},
    )
    assert both.status_code == 422
