from redis.exceptions import ConnectionError

from app.core.auth import hash_password
from app.extensions import db
from app.modules.orgs.models import Organization
from app.modules.users.models import ROLE_ADMIN, User


class FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.commands = []

    def incr(self, key):
        self.commands.append(("incr", key))
        return self

    def expire(self, key, seconds, nx=False):
        self.commands.append(("expire", key, seconds, nx))
        return self

    def ttl(self, key):
        self.commands.append(("ttl", key))
        return self

    def execute(self):
        results = []
        for command in self.commands:
            if command[0] == "incr":
                key = command[1]
                self.redis.values[key] = self.redis.values.get(key, 0) + 1
                results.append(self.redis.values[key])
            elif command[0] == "expire":
                _, key, seconds, nx = command
                if not nx or key not in self.redis.ttls:
                    self.redis.ttls[key] = seconds
                    results.append(True)
                else:
                    results.append(False)
            else:
                results.append(self.redis.ttls.get(command[1], -1))
        return results


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.ttls = {}

    def mget(self, *keys):
        return [self.values.get(key) for key in keys]

    def pipeline(self, transaction=True):
        return FakePipeline(self)

    def delete(self, key):
        self.values.pop(key, None)
        self.ttls.pop(key, None)
        return 1


def _seed_admin(app):
    with app.app_context():
        organization = Organization(name="Organização", slug="organizacao")
        db.session.add(organization)
        db.session.flush()
        user = User(
            organization_id=organization.id,
            email="admin@example.com",
            name="Admin",
            password_hash=hash_password("senha-segura"),
            role=ROLE_ADMIN,
        )
        db.session.add(user)
        db.session.commit()


def _enable_rate_limit(app):
    app.config.update(
        LYNK_LOGIN_RATE_LIMIT_ENABLED=True,
        LYNK_LOGIN_RATE_LIMIT_WINDOW_SECONDS=60,
        LYNK_LOGIN_RATE_LIMIT_IP_ATTEMPTS=10,
        LYNK_LOGIN_RATE_LIMIT_ACCOUNT_ATTEMPTS=2,
    )


def test_login_blocks_account_after_configured_failures(app, client, monkeypatch):
    from app.core import login_rate_limit

    _seed_admin(app)
    _enable_rate_limit(app)
    fake_redis = FakeRedis()
    monkeypatch.setattr(login_rate_limit, "get_redis", lambda application: fake_redis)

    first = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "errada"},
    )
    blocked = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "errada"},
    )

    assert first.status_code == 401
    assert blocked.status_code == 429
    assert blocked.get_json()["error"]["code"] == "too_many_login_attempts"
    assert blocked.headers["Retry-After"] == "60"
    assert all("admin@example.com" not in key for key in fake_redis.values)


def test_successful_login_clears_account_failures(app, client, monkeypatch):
    from app.core import login_rate_limit

    _seed_admin(app)
    _enable_rate_limit(app)
    fake_redis = FakeRedis()
    monkeypatch.setattr(login_rate_limit, "get_redis", lambda application: fake_redis)

    failed = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "errada"},
    )
    success = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "senha-segura"},
    )

    assert failed.status_code == 401
    assert success.status_code == 200
    assert len(fake_redis.values) == 1


def test_retry_after_uses_only_the_counter_that_blocked(app, monkeypatch):
    from app.core import login_rate_limit
    from app.core.login_rate_limit import LoginRateLimiter

    _enable_rate_limit(app)
    fake_redis = FakeRedis()
    monkeypatch.setattr(login_rate_limit, "get_redis", lambda application: fake_redis)
    limiter = LoginRateLimiter(app)
    ip_key, account_key = limiter._keys(  # noqa: SLF001 - verifies privacy-safe counters
        email="admin@example.com",
        remote_addr="127.0.0.1",
    )
    fake_redis.values[ip_key] = 1
    fake_redis.values[account_key] = 2
    fake_redis.ttls[ip_key] = 60
    fake_redis.ttls[account_key] = 10

    status = limiter.check(email="admin@example.com", remote_addr="127.0.0.1")

    assert status.blocked is True
    assert status.retry_after == 10


def test_ip_rate_limit_keys_ignore_source_port(app):
    from app.core.login_rate_limit import LoginRateLimiter

    _enable_rate_limit(app)
    limiter = LoginRateLimiter(app)

    assert limiter._keys(  # noqa: SLF001 - validates normalized per-IP identity
        email="admin@example.com",
        remote_addr="203.0.113.7:51234",
    ) == limiter._keys(email="admin@example.com", remote_addr="203.0.113.7")
    assert limiter._keys(  # noqa: SLF001 - validates normalized IPv6 identity
        email="admin@example.com",
        remote_addr="[2001:db8::7]:51234",
    ) == limiter._keys(email="admin@example.com", remote_addr="2001:db8::7")


def test_login_fails_closed_when_rate_limit_store_is_unavailable(app, client, monkeypatch):
    from app.core import login_rate_limit

    class UnavailableRedis(FakeRedis):
        def mget(self, *keys):
            raise ConnectionError("redis indisponível")

    _seed_admin(app)
    _enable_rate_limit(app)
    monkeypatch.setattr(
        login_rate_limit,
        "get_redis",
        lambda application: UnavailableRedis(),
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "senha-segura"},
    )

    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "auth_temporarily_unavailable"
