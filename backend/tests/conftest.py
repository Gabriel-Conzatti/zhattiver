import os

import pytest
from cachelib import FileSystemCache
from sqlalchemy import BigInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

os.environ.setdefault("LYNK_ENV", "testing")


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(element, compiler, **kwargs):
    return "JSON"


@compiles(BigInteger, "sqlite")
def _compile_big_integer_for_sqlite(element, compiler, **kwargs):
    return "INTEGER"


@pytest.fixture()
def app(monkeypatch, tmp_path):
    """Aplicação efêmera para validar contratos HTTP sem serviços externos."""
    monkeypatch.setenv("LYNK_ENV", "testing")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")

    from importlib import reload

    from app import config as app_config

    reload(app_config)
    from app import create_app
    from app.extensions import db

    application = create_app(
        "testing",
        overrides={
            "SESSION_TYPE": "filesystem",
            "SESSION_CACHELIB": FileSystemCache(str(tmp_path / "sessions")),
        },
    )
    application.config["TESTING"] = True

    with application.app_context():
        db.create_all()

    yield application

    with application.app_context():
        db.session.remove()
        db.drop_all()
