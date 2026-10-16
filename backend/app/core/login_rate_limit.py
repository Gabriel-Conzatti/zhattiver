from __future__ import annotations

import hashlib
import hmac
import ipaddress
from dataclasses import dataclass
from urllib.parse import urlsplit

from flask import Flask
from redis import Redis
from redis.exceptions import RedisError

from ..extensions import get_redis
from .errors import BusinessError


@dataclass(frozen=True)
class LoginRateLimitStatus:
    blocked: bool
    retry_after: int


class LoginRateLimiter:
    def __init__(self, app: Flask) -> None:
        self._app = app
        self._enabled = bool(app.config["LYNK_LOGIN_RATE_LIMIT_ENABLED"])
        self._window = int(app.config["LYNK_LOGIN_RATE_LIMIT_WINDOW_SECONDS"])
        self._ip_limit = int(app.config["LYNK_LOGIN_RATE_LIMIT_IP_ATTEMPTS"])
        self._account_limit = int(app.config["LYNK_LOGIN_RATE_LIMIT_ACCOUNT_ATTEMPTS"])
        if self._window < 1 or self._ip_limit < 1 or self._account_limit < 1:
            raise RuntimeError("Configuração de rate limiting do login inválida")

    def check(self, *, email: str, remote_addr: str) -> LoginRateLimitStatus:
        if not self._enabled:
            return LoginRateLimitStatus(blocked=False, retry_after=0)
        ip_key, account_key = self._keys(email=email, remote_addr=remote_addr)
        try:
            client = self._client()
            values = client.mget(ip_key, account_key)
            ip_count = int(values[0] or 0)
            account_count = int(values[1] or 0)
            if ip_count < self._ip_limit and account_count < self._account_limit:
                return LoginRateLimitStatus(blocked=False, retry_after=0)
            return LoginRateLimitStatus(
                blocked=True,
                retry_after=self._retry_after(
                    client,
                    (ip_key, ip_count, self._ip_limit),
                    (account_key, account_count, self._account_limit),
                ),
            )
        except RedisError as exc:
            self._unavailable(exc)

    def register_failure(self, *, email: str, remote_addr: str) -> LoginRateLimitStatus:
        if not self._enabled:
            return LoginRateLimitStatus(blocked=False, retry_after=0)
        ip_key, account_key = self._keys(email=email, remote_addr=remote_addr)
        try:
            client = self._client()
            pipeline = client.pipeline(transaction=True)
            for key in (ip_key, account_key):
                pipeline.incr(key)
                pipeline.expire(key, self._window, nx=True)
            results = pipeline.execute()
            ip_count = int(results[0])
            account_count = int(results[2])
            blocked = ip_count >= self._ip_limit or account_count >= self._account_limit
            return LoginRateLimitStatus(
                blocked=blocked,
                retry_after=(
                    self._retry_after(
                        client,
                        (ip_key, ip_count, self._ip_limit),
                        (account_key, account_count, self._account_limit),
                    )
                    if blocked
                    else 0
                ),
            )
        except RedisError as exc:
            self._unavailable(exc)

    def clear_account_failures(self, *, email: str) -> None:
        if not self._enabled:
            return
        account_key = self._key("account", email.strip().lower())
        try:
            self._client().delete(account_key)
        except RedisError as exc:
            self._unavailable(exc)

    def _keys(self, *, email: str, remote_addr: str) -> tuple[str, str]:
        return (
            self._key("ip", self._normalize_ip(remote_addr)),
            self._key("account", email.strip().lower()),
        )

    @staticmethod
    def _normalize_ip(remote_addr: str) -> str:
        try:
            return ipaddress.ip_address(remote_addr).compressed
        except ValueError:
            try:
                parsed = urlsplit(f"//{remote_addr}")
                if parsed.port is not None and parsed.hostname:
                    return ipaddress.ip_address(parsed.hostname).compressed
            except ValueError:
                pass
            return remote_addr

    def _key(self, scope: str, value: str) -> str:
        secret = str(self._app.config["SECRET_KEY"]).encode()
        digest = hmac.new(secret, value.encode(), hashlib.sha256).hexdigest()
        return f"lynk:auth:login:{scope}:{digest}"

    def _client(self) -> Redis:
        return get_redis(self._app)

    def _retry_after(
        self,
        client: Redis,
        *counters: tuple[str, int, int],
    ) -> int:
        pipeline = client.pipeline(transaction=False)
        blocked_keys = [key for key, count, limit in counters if count >= limit]
        for key in blocked_keys:
            pipeline.ttl(key)
        ttls = [int(value) for value in pipeline.execute() if int(value) > 0]
        return max(ttls, default=self._window)

    def _unavailable(self, exc: RedisError):
        self._app.logger.exception("lynk.auth.rate_limit_unavailable")
        raise BusinessError(
            "auth_temporarily_unavailable",
            "Autenticação temporariamente indisponível",
            status=503,
        ) from exc


__all__ = ["LoginRateLimitStatus", "LoginRateLimiter"]
