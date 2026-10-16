import pytest

from app.config import ProductionConfig, _validate_production_secrets, get_config


def test_unknown_environment_does_not_fall_back_to_development(monkeypatch):
    monkeypatch.setenv("LYNK_ENV", "prodution")

    with pytest.raises(RuntimeError, match="LYNK_ENV inválido"):
        get_config()


def test_production_rejects_example_secrets(monkeypatch):
    monkeypatch.setattr(
        ProductionConfig,
        "SECRET_KEY",
        "troque-me-em-producao-" + "x" * 40,
    )
    monkeypatch.setattr(ProductionConfig, "LYNK_CSRF_SECRET", "x" * 40)

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        _validate_production_secrets(ProductionConfig)


def test_production_rejects_short_secrets(monkeypatch):
    monkeypatch.setattr(ProductionConfig, "SECRET_KEY", "s" * 31)
    monkeypatch.setattr(ProductionConfig, "LYNK_CSRF_SECRET", "c" * 31)

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        _validate_production_secrets(ProductionConfig)
