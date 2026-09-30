from __future__ import annotations

import re

import phonenumbers

_DEFAULT_REGION = "BR"


class PhoneNormalizationError(ValueError):
    pass


def normalize_phone(raw: str | None, *, region: str = _DEFAULT_REGION) -> str:
    """Retorna o telefone em E.164 (ex.: +5551999999999).

    Lança PhoneNormalizationError quando não é possível normalizar. Espaços, pontos,
    hífens, parênteses e o prefixo `+` são aceitos. Números apenas com dígitos e sem
    código de país são tratados como sendo do `region`.
    """
    if not raw or not raw.strip():
        raise PhoneNormalizationError("Telefone vazio")

    candidate = raw.strip()
    only_digits = re.sub(r"\D", "", candidate)
    if not only_digits:
        raise PhoneNormalizationError("Telefone sem dígitos")

    # Se veio com "+", parseamos direto. Caso contrário, deixamos a lib deduzir.
    try:
        parsed = phonenumbers.parse(
            candidate if candidate.startswith("+") else only_digits,
            None if candidate.startswith("+") else region,
        )
    except phonenumbers.NumberParseException as exc:
        raise PhoneNormalizationError(str(exc)) from exc

    if not phonenumbers.is_possible_number(parsed):
        raise PhoneNormalizationError("Telefone inválido")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def format_phone_local(e164: str) -> str:
    """Formata em BR (ex.: (51) 99999-9999) para exibição."""
    try:
        parsed = phonenumbers.parse(e164, None)
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.NATIONAL)
    except phonenumbers.NumberParseException:
        return e164
