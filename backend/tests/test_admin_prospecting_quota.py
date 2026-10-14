from datetime import timedelta

from app.core.auth import hash_password
from app.core.time import today_local
from app.extensions import db
from app.modules.audit.models import AuditLog
from app.modules.goals.models import DailyProspectingQuota
from app.modules.orgs.models import Organization
from app.modules.users.models import ROLE_ADMIN, ROLE_VENDEDOR, User


def _seed_users(app) -> dict[str, str]:
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


def _login_admin(client) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "senha-segura"},
    )
    assert response.status_code == 200
    csrf = client.get_cookie("lynk_csrf")
    assert csrf is not None
    return {"X-CSRF-Token": csrf.value}


def test_admin_sets_versioned_daily_prospecting_quota(app):
    ids = _seed_users(app)
    client = app.test_client()
    headers = _login_admin(client)
    today = today_local()
    tomorrow = today + timedelta(days=1)

    initial = client.patch(
        f"/api/v1/admin/users/{ids['seller_id']}",
        json={
            "daily_prospecting_quota": 12,
            "quota_effective_from": today.isoformat(),
        },
        headers=headers,
    )
    future = client.patch(
        f"/api/v1/admin/users/{ids['seller_id']}",
        json={
            "daily_prospecting_quota": 20,
            "quota_effective_from": tomorrow.isoformat(),
        },
        headers=headers,
    )

    assert initial.status_code == 200
    assert initial.get_json()["daily_prospecting_quota"] == 12
    assert initial.get_json()["quota_effective_from"] == today.isoformat()
    assert future.status_code == 200
    assert future.get_json()["daily_prospecting_quota"] == 12

    with app.app_context():
        rows = (
            db.session.query(DailyProspectingQuota)
            .filter_by(user_id=ids["seller_id"])
            .order_by(DailyProspectingQuota.effective_from)
            .all()
        )
        assert [(row.quota, row.effective_from, row.effective_to) for row in rows] == [
            (12, today, today),
            (20, tomorrow, None),
        ]
        audit = (
            db.session.query(AuditLog)
            .filter_by(entity_type="user", entity_id=ids["seller_id"], action="update")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert audit is not None
        assert audit.after["daily_prospecting_quota"] == 20
        assert audit.after["quota_effective_from"] == tomorrow.isoformat()


def test_admin_rejects_daily_quota_for_non_seller(app):
    ids = _seed_users(app)
    client = app.test_client()
    headers = _login_admin(client)

    response = client.patch(
        f"/api/v1/admin/users/{ids['admin_id']}",
        json={"daily_prospecting_quota": 10},
        headers=headers,
    )

    assert response.status_code == 422
    assert response.get_json()["error"]["code"] == "invalid_role"
    with app.app_context():
        assert db.session.query(DailyProspectingQuota).count() == 0
