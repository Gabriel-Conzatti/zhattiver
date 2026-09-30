"""Renderização segura de templates com placeholders `{chave}`."""

from __future__ import annotations

import re

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def render_template(template: str | None, variables: dict[str, str | None]) -> str:
    """Substitui `{chave}` por variables[chave] com fallback vazio.

    Nunca executa código; ignora placeholders desconhecidos removendo-os.
    """
    if not template:
        return ""

    def _sub(match: re.Match[str]) -> str:
        key = match.group(1)
        value = variables.get(key)
        return "" if value is None else str(value)

    rendered = _PLACEHOLDER_RE.sub(_sub, template)
    # Colapsa espaços duplicados que aparecem quando um placeholder some.
    rendered = re.sub(r"[ \t]{2,}", " ", rendered)
    return rendered.strip()
