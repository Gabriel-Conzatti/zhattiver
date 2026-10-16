from __future__ import annotations

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class BaseConfig:
    LYNK_ENV = os.getenv("LYNK_ENV", "development")
    LYNK_TIMEZONE = os.getenv("LYNK_TIMEZONE", "America/Sao_Paulo")
    LYNK_LOCALE = os.getenv("LYNK_LOCALE", "pt_BR")
    LYNK_DAILY_METAS_CLOSE_HOUR = int(os.getenv("LYNK_DAILY_METAS_CLOSE_HOUR", "19"))

    SECRET_KEY = os.getenv("LYNK_SECRET_KEY", "dev-secret-change-me")
    LYNK_CSRF_SECRET = os.getenv("LYNK_CSRF_SECRET", SECRET_KEY)

    # SQLAlchemy
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://lynk:lynk@localhost:5432/lynk",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # Redis / sessão
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    SESSION_TYPE = "redis"
    SESSION_KEY_PREFIX = "lynk:session:"
    SESSION_USE_SIGNER = True
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(
        minutes=int(os.getenv("LYNK_SESSION_LIFETIME_MINUTES", "720"))
    )
    LYNK_SESSION_IDLE_MINUTES = int(os.getenv("LYNK_SESSION_IDLE_MINUTES", "120"))
    LYNK_LOGIN_RATE_LIMIT_ENABLED = _bool(
        os.getenv("LYNK_LOGIN_RATE_LIMIT_ENABLED"),
        default=True,
    )
    LYNK_LOGIN_RATE_LIMIT_WINDOW_SECONDS = int(
        os.getenv("LYNK_LOGIN_RATE_LIMIT_WINDOW_SECONDS", "900")
    )
    LYNK_LOGIN_RATE_LIMIT_IP_ATTEMPTS = int(
        os.getenv("LYNK_LOGIN_RATE_LIMIT_IP_ATTEMPTS", "20")
    )
    LYNK_LOGIN_RATE_LIMIT_ACCOUNT_ATTEMPTS = int(
        os.getenv("LYNK_LOGIN_RATE_LIMIT_ACCOUNT_ATTEMPTS", "8")
    )
    SESSION_COOKIE_NAME = os.getenv("LYNK_SESSION_COOKIE_NAME", "lynk_session")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False  # sobrescrito em produção
    SESSION_COOKIE_PATH = "/"

    # CSRF
    LYNK_CSRF_COOKIE_NAME = "lynk_csrf"

    # Celery
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

    # SMTP
    LYNK_SMTP_HOST = os.getenv("LYNK_SMTP_HOST", "")
    LYNK_SMTP_PORT = int(os.getenv("LYNK_SMTP_PORT", "587") or 587)
    LYNK_SMTP_USERNAME = os.getenv("LYNK_SMTP_USERNAME", "")
    LYNK_SMTP_PASSWORD = os.getenv("LYNK_SMTP_PASSWORD", "")
    LYNK_SMTP_FROM = os.getenv("LYNK_SMTP_FROM", "")
    LYNK_PUBLIC_URL = (
        os.getenv("LYNK_PUBLIC_URL")
        or (
            f"https://{os.getenv('LYNK_DOMAIN')}"
            if os.getenv("LYNK_DOMAIN")
            else "http://localhost:5173"
        )
    ).rstrip("/")
    LYNK_PASSWORD_RESET_TTL_MINUTES = int(
        os.getenv("LYNK_PASSWORD_RESET_TTL_MINUTES", "30")
    )
    LYNK_PASSWORD_RESET_COOLDOWN_SECONDS = int(
        os.getenv("LYNK_PASSWORD_RESET_COOLDOWN_SECONDS", "60")
    )


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SESSION_COOKIE_SECURE = False


class ProductionConfig(BaseConfig):
    DEBUG = False
    SESSION_COOKIE_SECURE = True


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    SESSION_COOKIE_SECURE = False
    SESSION_TYPE = "filesystem"
    LYNK_LOGIN_RATE_LIMIT_ENABLED = False
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://lynk:lynk@localhost:5432/lynk_test",
    )


_CONFIGS = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(name: str | None = None) -> type[BaseConfig]:
    key = (name or os.getenv("LYNK_ENV", "development")).lower()
    config = _CONFIGS.get(key)
    if config is None:
        raise RuntimeError(f"Ambiente LYNK_ENV inválido: {key}")
    if config is ProductionConfig:
        _validate_production_secrets(config)
    return config


def _validate_production_secrets(config: type[BaseConfig]) -> None:
    placeholders = ("dev-secret-change-me", "troque-me-em-producao-")
    for name in ("SECRET_KEY", "LYNK_CSRF_SECRET"):
        value = str(getattr(config, name, ""))
        if (
            len(value.encode("utf-8")) < 32
            or any(value.startswith(placeholder) for placeholder in placeholders)
        ):
            raise RuntimeError(
                f"{name} deve conter pelo menos 32 bytes e não pode ser um valor padrão "
                "ou de exemplo em produção"
            )
