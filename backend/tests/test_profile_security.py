from datetime import UTC, datetime, timedelta

from app.core.auth import hash_password
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.auth.models import PasswordResetToken
from app.modules.auth.password_recovery import (
    PasswordResetDeliveryError,
    hash_reset_token,
)
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


def test_password_recovery_does_not_disclose_accounts_and_stores_only_hash(
    app, monkeypatch
):
    _seed_users(app)
    delivered: list[str] = []
    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        lambda user, token: delivered.append(token),
    )
    client = app.test_client()

    existing = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )
    missing = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "inexistente@example.com"},
    )
    repeated = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )

    assert existing.status_code == missing.status_code == repeated.status_code == 202
    assert existing.get_json() == missing.get_json() == repeated.get_json()
    assert len(delivered) == 1
    with app.app_context():
        token = db.session.query(PasswordResetToken).one()
        assert token.token_hash == hash_reset_token(delivered[0])
        assert token.token_hash != delivered[0]
        audit = db.session.query(AuditLog).filter_by(
            action="password_reset_requested"
        ).one()
        assert delivered[0] not in str(audit.before)
        assert delivered[0] not in str(audit.after)


def test_password_recovery_is_single_use_and_invalidates_sessions(app, monkeypatch):
    _seed_users(app)
    delivered: list[str] = []
    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        lambda user, token: delivered.append(token),
    )
    authenticated_client = app.test_client()
    assert _login(authenticated_client, "vendedor@example.com").status_code == 200
    recovery_client = app.test_client()
    requested = recovery_client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )
    assert requested.status_code == 202

    changed = recovery_client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[0], "new_password": "senha-nova-segura"},
    )
    reused = recovery_client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[0], "new_password": "outra-senha-segura"},
    )

    assert changed.status_code == 204
    assert reused.status_code == 422
    assert reused.get_json()["error"]["code"] == "invalid_password_reset_token"
    invalidated = authenticated_client.get("/api/v1/auth/me")
    assert invalidated.status_code == 401
    assert invalidated.get_json()["error"]["code"] == "session_invalidated"
    fresh_client = app.test_client()
    assert _login(fresh_client, "vendedor@example.com").status_code == 401
    assert (
        _login(fresh_client, "vendedor@example.com", "senha-nova-segura").status_code
        == 200
    )
    with app.app_context():
        token = db.session.query(PasswordResetToken).one()
        assert token.used_at is not None
        audit = db.session.query(AuditLog).filter_by(
            action="password_reset_completed"
        ).one()
        assert audit.after == {"sessions_invalidated": True}


def test_password_recovery_rejects_expired_token(app, monkeypatch):
    _seed_users(app)
    delivered: list[str] = []
    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        lambda user, token: delivered.append(token),
    )
    client = app.test_client()
    client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )
    with app.app_context():
        token = db.session.query(PasswordResetToken).one()
        token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.session.commit()

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[0], "new_password": "senha-nova-segura"},
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "invalid_password_reset_token"


def test_password_recovery_does_not_issue_token_for_inactive_user(app, monkeypatch):
    user_ids = _seed_users(app)
    delivered: list[str] = []
    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        lambda user, token: delivered.append(token),
    )
    with app.app_context():
        user = db.session.get(User, user_ids["seller_id"])
        user.is_active = False
        db.session.commit()

    response = app.test_client().post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )

    assert response.status_code == 202
    assert delivered == []
    with app.app_context():
        assert db.session.query(PasswordResetToken).count() == 0


def test_password_recovery_invalidates_token_after_delivery_failure(
    app, monkeypatch, caplog
):
    _seed_users(app)
    delivered: list[str] = []

    def fail_delivery(user, token):
        delivered.append(token)
        raise PasswordResetDeliveryError("Falha simulada")

    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        fail_delivery,
    )
    client = app.test_client()

    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "vendedor@example.com"},
    )

    assert response.status_code == 202
    assert delivered[0] not in caplog.text
    assert "vendedor@example.com" not in caplog.text
    with app.app_context():
        assert db.session.query(PasswordResetToken).one().used_at is not None
    rejected = client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[0], "new_password": "senha-nova-segura"},
    )
    assert rejected.status_code == 422


def test_new_password_recovery_request_invalidates_previous_token(
    app, monkeypatch
):
    _seed_users(app)
    app.config["LYNK_PASSWORD_RESET_COOLDOWN_SECONDS"] = 0
    delivered: list[str] = []
    monkeypatch.setattr(
        "app.modules.auth.routes.send_password_reset_email",
        lambda user, token: delivered.append(token),
    )
    client = app.test_client()
    for _ in range(2):
        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "vendedor@example.com"},
        )
        assert response.status_code == 202

    assert len(delivered) == 2
    previous = client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[0], "new_password": "senha-nova-segura"},
    )
    current = client.post(
        "/api/v1/auth/reset-password",
        json={"token": delivered[1], "new_password": "senha-nova-segura"},
    )
    assert previous.status_code == 422
    assert current.status_code == 204
