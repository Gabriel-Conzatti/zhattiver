from __future__ import annotations

import logging
from typing import Any

from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix

from .config import get_config
from .extensions import db, login_manager, migrate, session_ext
from .core.logging import configure_logging


def create_app(config_name: str | None = None, overrides: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    config = get_config(config_name)
    app.config.from_object(config)
    if overrides:
        app.config.update(overrides)

    if app.config.get("LYNK_ENV") == "production":
        # Único proxy confiável: Caddy (dentro da rede interna do Compose).
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=0)

    configure_logging(app)

    _init_extensions(app)
    _register_blueprints(app)
    _register_error_handlers(app)
    _register_cli(app)
    _register_request_hooks(app)

    app.logger.info("lynk.app.ready", extra={"env": app.config["LYNK_ENV"]})
    return app


def _init_extensions(app: Flask) -> None:
    db.init_app(app)
    # Importa todos os modelos para que Alembic os enxergue.
    from . import models  # noqa: F401
    migrate.init_app(app, db)

    if app.config.get("SESSION_TYPE") == "redis":
        from .extensions import get_redis

        app.config["SESSION_REDIS"] = get_redis(app)
    session_ext.init_app(app)
    login_manager.init_app(app)

    from .modules.users.models import User

    @login_manager.user_loader
    def _load_user(user_id: str) -> User | None:  # pragma: no cover - trivial
        try:
            return db.session.get(User, user_id)
        except Exception:  # noqa: BLE001
            return None

    @login_manager.unauthorized_handler
    def _unauthorized():
        from .core.errors import api_error

        return api_error("unauthorized", "Autenticação necessária", status=401)


def _register_blueprints(app: Flask) -> None:
    from .modules.admin.routes import bp as admin_bp
    from .modules.auth.routes import bp as auth_bp
    from .modules.bonus.routes import bp as bonus_bp
    from .modules.catalog.routes import bp as catalog_bp
    from .modules.cross_sell.routes import bp as cross_sell_bp
    from .modules.health.routes import bp as health_bp
    from .modules.imports.routes import bp as imports_bp
    from .modules.leads.routes import bp as leads_bp
    from .modules.management.routes import bp as management_bp
    from .modules.notifications.routes import bp as notifications_bp
    from .modules.opportunities.routes import bp as opportunities_bp
    from .modules.sales.routes import bp as sales_bp
    from .modules.schedules.routes import bp as schedules_bp

    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(catalog_bp, url_prefix="/api/v1")
    app.register_blueprint(leads_bp, url_prefix="/api/v1")
    app.register_blueprint(imports_bp, url_prefix="/api/v1")
    app.register_blueprint(opportunities_bp, url_prefix="/api/v1")
    app.register_blueprint(schedules_bp, url_prefix="/api/v1")
    app.register_blueprint(sales_bp, url_prefix="/api/v1")
    app.register_blueprint(bonus_bp, url_prefix="/api/v1")
    app.register_blueprint(admin_bp, url_prefix="/api/v1")
    app.register_blueprint(management_bp, url_prefix="/api/v1")
    app.register_blueprint(cross_sell_bp, url_prefix="/api/v1")
    app.register_blueprint(notifications_bp, url_prefix="/api/v1")


def _register_error_handlers(app: Flask) -> None:
    from .core.errors import install_error_handlers

    install_error_handlers(app)


def _register_cli(app: Flask) -> None:
    from .cli import register as register_cli

    register_cli(app)


def _register_request_hooks(app: Flask) -> None:
    from .core.csrf import init_csrf
    from .core.request_context import init_request_context

    init_request_context(app)
    init_csrf(app)


__all__ = ["create_app"]
