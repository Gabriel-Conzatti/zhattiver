from __future__ import annotations

import hmac
import secrets

from flask import Flask, request

from .errors import api_error

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
HEADER_NAME = "X-CSRF-Token"


def _new_token() -> str:
    return secrets.token_urlsafe(32)


def verify_token(cookie_value: str | None, header_value: str | None) -> bool:
    if not cookie_value or not header_value:
        return False
    return hmac.compare_digest(cookie_value, header_value)


def init_csrf(app: Flask) -> None:
    """Double-submit token: cookie legível pelo JS + header enviado pelo cliente."""
    cookie_name = app.config["LYNK_CSRF_COOKIE_NAME"]

    @app.before_request
    def _enforce_csrf():
        if request.method in SAFE_METHODS:
            return None
        if not request.path.startswith("/api/"):
            return None
        cookie_value = request.cookies.get(cookie_name)
        header_value = request.headers.get(HEADER_NAME)
        if request.path == "/api/v1/auth/login":
            # No login o cookie pode ainda não ter sido lido; se veio, precisa bater.
            if header_value and cookie_value and not verify_token(cookie_value, header_value):
                return api_error("csrf_invalid", "Token CSRF inválido", status=403)
            return None
        if not verify_token(cookie_value, header_value):
            return api_error("csrf_invalid", "Token CSRF ausente ou inválido", status=403)
        return None

    @app.after_request
    def _issue_cookie(response):
        if request.cookies.get(cookie_name):
            return response
        token = _new_token()
        response.set_cookie(
            cookie_name,
            token,
            httponly=False,
            samesite=app.config.get("SESSION_COOKIE_SAMESITE", "Lax"),
            secure=app.config.get("SESSION_COOKIE_SECURE", False),
            path="/",
        )
        return response
