from app.core.auth import hash_password
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.orgs.models import Organization
from app.modules.users.models import ROLE_ADMIN, ROLE_VENDEDOR, User


def _seed_users(app):
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
        seller = User(
            organization_id=organization.id,
            email="vendedor@example.com",
            name="Vendedor",
            password_hash=hash_password("senha-segura"),
            role=ROLE_VENDEDOR,
        )
        db.session.add_all([admin, seller])
        db.session.commit()
        return {"admin_id": str(admin.id), "seller_id": str(seller.id)}


def _login(client, email: str, password: str = "senha-segura"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def _csrf_headers(client):
    token = client.get_cookie("lynk_csrf")
    assert token is not None
    return {"X-CSRF-Token": token.value}


def test_password_change_invalidates_other_sessions_and_preserves_current(app):
    _seed_users(app)
    current_client = app.test_client()
    other_client = app.test_client()
    assert _login(current_client, "vendedor@example.com").status_code == 200
    other_login = _login(other_client, "vendedor@example.com")
    assert other_login.status_code == 200, other_login.get_json()

    changed = current_client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "senha-segura",
            "new_password": "nova-senha-segura",
        },
        headers=_csrf_headers(current_client),
    )

    assert changed.status_code == 204
    assert current_client.get("/api/v1/auth/me").status_code == 200
    invalidated = other_client.get("/api/v1/auth/me")
    assert invalidated.status_code == 401
    assert invalidated.get_json()["error"]["code"] == "session_invalidated"

    fresh_client = app.test_client()
    assert _login(fresh_client, "vendedor@example.com").status_code == 401
    assert _login(fresh_client, "vendedor@example.com", "nova-senha-segura").status_code == 200

    with app.app_context():
        entry = db.session.query(AuditLog).filter_by(action="password_change").one()
        assert entry.after == {"sessions_invalidated": True}
        assert entry.before is None


def test_password_change_rejects_wrong_or_reused_password(app):
    _seed_users(app)
    client = app.test_client()
    assert _login(client, "vendedor@example.com").status_code == 200
    headers = _csrf_headers(client)

    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "incorreta", "new_password": "nova-senha-segura"},
        headers=headers,
    )
    unchanged = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "senha-segura", "new_password": "senha-segura"},
        headers=headers,
    )

    assert wrong.status_code == 422
    assert wrong.get_json()["error"]["code"] == "invalid_current_password"
    assert unchanged.status_code == 422
    assert unchanged.get_json()["error"]["code"] == "password_unchanged"


def test_profile_update_changes_only_current_users_name(app):
    user_ids = _seed_users(app)
    client = app.test_client()
    assert _login(client, "vendedor@example.com").status_code == 200

    response = client.patch(
        "/api/v1/auth/profile",
        json={"name": "  Novo Nome  "},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.get_json()["name"] == "Novo Nome"
    assert response.get_json()["email"] == "vendedor@example.com"
    with app.app_context():
        assert db.session.get(User, user_ids["seller_id"]).name == "Novo Nome"
        assert db.session.get(User, user_ids["admin_id"]).name == "Admin"


def test_admin_password_reset_invalidates_target_sessions(app):
    user_ids = _seed_users(app)
    admin_client = app.test_client()
    admin_login = _login(admin_client, "admin@example.com")
    assert admin_login.status_code == 200, admin_login.get_json()

    reset = admin_client.patch(
        f"/api/v1/admin/users/{user_ids['seller_id']}",
        json={"reset_password": "senha-redefinida"},
        headers=_csrf_headers(admin_client),
    )

    assert reset.status_code == 200
    with app.app_context():
        assert db.session.get(User, user_ids["seller_id"]).session_version == 2
    seller_client = app.test_client()
    assert _login(seller_client, "vendedor@example.com").status_code == 401
    assert _login(seller_client, "vendedor@example.com", "senha-redefinida").status_code == 200
