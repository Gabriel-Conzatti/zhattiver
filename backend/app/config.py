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
    return _CONFIGS.get(key, DevelopmentConfig)
