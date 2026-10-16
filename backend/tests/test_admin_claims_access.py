from app.core.auth import hash_password
from app.extensions import db
from app.modules.orgs.models import Organization
from app.modules.users.models import ROLE_ADMIN, PermissionGrant, User


def _seed_admin(app) -> str:
    with app.app_context():
        organization = Organization(name="Organização", slug="organizacao")
        db.session.add(organization)
        db.session.flush()
        admin = User(
            organization_id=organization.id,
            email="admin@example.com",
            name="Admin",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        db.session.add(admin)
        db.session.commit()
        return str(admin.id)


def _login_admin(client) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "senha-segura"},
    )
    assert response.status_code == 200
    csrf = client.get_cookie("lynk_csrf")
    assert csrf is not None
    return {"X-CSRF-Token": csrf.value}


def _active_permissions(app, user_id: str) -> set[str]:
    with app.app_context():
        return {
            grant.permission
            for grant in db.session.query(PermissionGrant)
            .filter_by(user_id=user_id, revoked_at=None)
            .all()
        }


def test_admin_grants_and_revokes_claims_access(app):
    _seed_admin(app)
    client = app.test_client()
    headers = _login_admin(client)

    created = client.post(
        "/api/v1/admin/users",
        json={
            "email": "sinistro@example.com",
            "name": "Equipe Sinistros",
            "role": "sdr",
            "password": "senha-segura-1",
            "claims_access": "manage",
        },
        headers=headers,
    )
    assert created.status_code == 201
    body = created.get_json()
    assert body["claims_access"] == "manage"
    user_id = body["id"]
    assert _active_permissions(app, user_id) == {"claims.manage"}

    downgraded = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"claims_access": "read"},
        headers=headers,
    )
    assert downgraded.status_code == 200
    assert downgraded.get_json()["claims_access"] == "read"
    assert _active_permissions(app, user_id) == {"claims.read"}

    removed = client.patch(
        f"/api/v1/admin/users/{user_id}",
        json={"claims_access": "none"},
        headers=headers,
    )
    assert removed.status_code == 200
    assert removed.get_json()["claims_access"] == "none"
    assert _active_permissions(app, user_id) == set()


def test_admin_profile_always_manages_claims(app):
    admin_id = _seed_admin(app)
    client = app.test_client()
    headers = _login_admin(client)

    listed = client.get("/api/v1/admin/users", headers=headers)
    assert listed.status_code == 200
    rows = {row["id"]: row for row in listed.get_json()["items"]}
    assert rows[admin_id]["claims_access"] == "manage"

    rejected = client.patch(
        f"/api/v1/admin/users/{admin_id}",
        json={"claims_access": "none"},
        headers=headers,
    )
    assert rejected.status_code == 422
    assert rejected.get_json()["error"]["code"] == "invalid_claims_access"


def test_claims_only_profile_cannot_access_other_modules(app):
    _seed_admin(app)
    client = app.test_client()
    headers = _login_admin(client)

    created = client.post(
        "/api/v1/admin/users",
        json={
            "email": "somente.sinistros@example.com",
            "name": "Somente Sinistros",
            "role": "sinistros",
            "password": "senha-segura-1",
            "claims_access": "manage",
        },
        headers=headers,
    )
    assert created.status_code == 201
    assert created.get_json()["role"] == "sinistros"
    assert created.get_json()["claims_access"] == "manage"

    client.post("/api/v1/auth/logout", headers=headers)
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "somente.sinistros@example.com",
            "password": "senha-segura-1",
        },
    )
    assert login.status_code == 200
    assert login.get_json()["role"] == "sinistros"

    assert client.get("/api/v1/claims/statuses").status_code == 200
    forbidden = client.get("/api/v1/leads")
    assert forbidden.status_code == 403
    assert forbidden.get_json()["error"]["code"] == "forbidden"


def test_claims_only_profile_requires_claims_access(app):
    _seed_admin(app)
    client = app.test_client()
    headers = _login_admin(client)

    rejected = client.post(
        "/api/v1/admin/users",
        json={
            "email": "sem-acesso@example.com",
            "name": "Sem Acesso",
            "role": "sinistros",
            "password": "senha-segura-1",
            "claims_access": "none",
        },
        headers=headers,
    )
    assert rejected.status_code == 422
    assert rejected.get_json()["error"]["code"] == "invalid_claims_access"
