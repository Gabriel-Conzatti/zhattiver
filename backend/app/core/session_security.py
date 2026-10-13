from __future__ import annotations

from flask import Flask, request, session
from flask_login import current_user, logout_user

from .errors import api_error


def init_session_security(app: Flask) -> None:
    @app.before_request
    def _enforce_session_version():
        if request.endpoint in {
            "auth.login",
            "auth.logout",
            "auth.forgot_password",
            "auth.reset_password",
        }:
            return None
        if not current_user.is_authenticated:
            return None
        current_version = session.get("auth_version")
        if current_version == current_user.session_version:
            return None
        logout_user()
        session.clear()
        return api_error(
            "session_invalidated",
            "Sessão invalidada. Entre novamente.",
            status=401,
        )


__all__ = ["init_session_security"]
