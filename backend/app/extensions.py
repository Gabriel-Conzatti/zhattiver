from __future__ import annotations

from flask_login import LoginManager
from flask_migrate import Migrate
from flask_session import Session
from flask_sqlalchemy import SQLAlchemy
from redis import Redis
from sqlalchemy import MetaData

_naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

db = SQLAlchemy(metadata=MetaData(naming_convention=_naming_convention))
migrate = Migrate()
login_manager = LoginManager()
session_ext = Session()


def get_redis(app) -> Redis:
    """Cliente Redis compartilhado (usado por sessão e locks)."""
    url = app.config["REDIS_URL"]
    return Redis.from_url(url)
