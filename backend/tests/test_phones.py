import pytest

from app.core.phones import PhoneNormalizationError, format_phone_local, normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "(51) 99999-9999",
        "51 99999-9999",
        "51999999999",
        "+55 51 99999-9999",
        "  +55 51 99999-9999  ",
    ],
)
def test_equivalent_numbers_normalize_to_same_e164(raw: str):
    assert normalize_phone(raw) == "+5551999999999"


def test_invalid_phone_raises():
    with pytest.raises(PhoneNormalizationError):
        normalize_phone("abc")
    with pytest.raises(PhoneNormalizationError):
        normalize_phone("")


def test_format_local_returns_readable():
    assert "51" in format_phone_local("+5551999999999")
