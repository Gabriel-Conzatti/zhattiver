import pytest


@pytest.fixture()
def app(monkeypatch, tmp_path):
    """App em modo `testing`; usa SQLite em memória e filesystem sessions em pasta temporária.

    Não cria schema — o teste toca apenas `/api/v1/health`, que não usa banco.
    """
    monkeypatch.setenv("LYNK_ENV", "testing")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")

    from importlib import reload

    from app import config as app_config

    reload(app_config)
    from app import create_app

    application = create_app(
        "testing",
        overrides={
            "SESSION_TYPE": "filesystem",
            "SESSION_FILE_DIR": str(tmp_path / "sessions"),
        },
    )
    application.config["TESTING"] = True
    return application


def test_health_endpoint_reports_ok(app):
    client = app.test_client()
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert "time" in data
