from __future__ import annotations

from flask import Flask, request, session
from flask_login import logout_user
from sqlalchemy import select

from ..extensions import db
from ..modules.users.models import User
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
        user_id = session.get("_user_id")
        if not user_id:
            return None
        user = db.session.scalar(
            select(User)
            .where(User.id == user_id)
            .execution_options(populate_existing=True)
        )
        current_version = session.get("auth_version")
        if user is not None and user.is_active and current_version == user.session_version:
            return None
        logout_user()
        session.clear()
        return api_error(
            "session_invalidated",
            "Sessão invalidada. Entre novamente.",
            status=401,
        )


__all__ = ["init_session_security"]
