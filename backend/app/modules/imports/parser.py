from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Iterable

from openpyxl import load_workbook

from ...core.phones import PhoneNormalizationError, normalize_phone


EXPECTED_COLUMNS = {
    "name": ["nome", "cliente", "lead", "name"],
    "phone": ["telefone", "celular", "phone", "fone"],
    "document": ["cpf", "cnpj", "documento", "document"],
    "city": ["cidade", "city"],
    "state": ["uf", "estado", "state"],
    "indicator": ["indicador", "indicado por", "indicator"],
    "notes": ["observacao", "observação", "notes", "nota"],
    "plate": ["placa", "plate"],
    "model": ["modelo", "model", "veiculo", "veículo"],
    "year": ["ano", "year"],
}


@dataclass
class ParsedRow:
    line_no: int
    raw: dict[str, str]
    normalized: dict | None
    errors: list[str]


def _resolve_columns(headers: list[str]) -> dict[str, str | None]:
    """Devolve o mapeamento canonical -> header original (ou None)."""
    lower = {h.strip().lower(): h for h in headers if h}
    resolved: dict[str, str | None] = {}
    for canonical, options in EXPECTED_COLUMNS.items():
        found: str | None = None
        for opt in options:
            if opt in lower:
                found = lower[opt]
                break
        resolved[canonical] = found
    return resolved


def _iter_csv(file_bytes: bytes) -> Iterable[dict[str, str]]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    # Auto-detecta delimitador simples entre ';' e ','
    sample = text[:2048]
    delim = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    for row in reader:
        yield {(k or "").strip(): (v or "") for k, v in row.items()}


def _iter_xlsx(file_bytes: bytes) -> Iterable[dict[str, str]]:
    wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        return
    rows = ws.iter_rows(values_only=True)
    headers_raw = next(rows, None)
    if not headers_raw:
        return
    headers = [str(h).strip() if h is not None else "" for h in headers_raw]
    for row in rows:
        yield {
            headers[i]: ("" if row[i] is None else str(row[i]))
            for i in range(min(len(headers), len(row)))
        }


def _sanitize_csv_value(value: str) -> str:
    """Neutraliza fórmulas em CSV/XLSX (CSV injection)."""
    if value and value[0] in ("=", "+", "-", "@"):
        return "'" + value
    return value


def parse_leads_file(filename: str, file_bytes: bytes) -> tuple[list[ParsedRow], list[str]]:
    """Retorna linhas parseadas e a lista de headers reconhecidos.

    Nunca lança — cada linha guarda seus próprios erros.
    """
    name_lower = filename.lower()
    if name_lower.endswith(".csv"):
        iterator = _iter_csv(file_bytes)
    elif name_lower.endswith(".xlsx"):
        iterator = _iter_xlsx(file_bytes)
    else:
        return [], []

    rows: list[ParsedRow] = []
    headers_captured: list[str] = []
    resolved: dict[str, str | None] | None = None

    for line_no, raw in enumerate(iterator, start=2):
        raw = {k: _sanitize_csv_value(str(v).strip()) for k, v in raw.items()}
        if resolved is None:
            headers_captured = list(raw.keys())
            resolved = _resolve_columns(headers_captured)
            if resolved.get("name") is None or resolved.get("phone") is None:
                # arquivo sem colunas mínimas: registra erro global na primeira linha
                rows.append(
                    ParsedRow(
                        line_no=line_no,
                        raw=raw,
                        normalized=None,
                        errors=[
                            "Colunas mínimas 'nome' e 'telefone' não encontradas no cabeçalho",
                        ],
                    )
                )
                # ainda assim continuamos processando para reportar cada linha
        errors: list[str] = []
        name = raw.get(resolved.get("name") or "", "").strip() if resolved else ""
        phone_raw = raw.get(resolved.get("phone") or "", "").strip() if resolved else ""
        phone_e164: str | None = None
        if not name:
            errors.append("Nome ausente")
        if not phone_raw:
            errors.append("Telefone ausente")
        else:
            try:
                phone_e164 = normalize_phone(phone_raw)
            except PhoneNormalizationError as exc:
                errors.append(f"Telefone inválido: {exc}")

        normalized: dict | None = None
        if not errors:
            normalized = {
                "name": name,
                "phones": [{"e164": phone_e164, "original": phone_raw}],
                "document": raw.get(resolved.get("document") or "", "").strip() or None,
                "city": raw.get(resolved.get("city") or "", "").strip() or None,
                "state": (raw.get(resolved.get("state") or "", "").strip() or None) and raw.get(resolved.get("state") or "", "").strip().upper(),
                "indicator_name": raw.get(resolved.get("indicator") or "", "").strip() or None,
                "notes": raw.get(resolved.get("notes") or "", "").strip() or None,
                "vehicle": {
                    "plate": (raw.get(resolved.get("plate") or "", "").strip() or None),
                    "model": (raw.get(resolved.get("model") or "", "").strip() or None),
                    "year": (raw.get(resolved.get("year") or "", "").strip() or None),
                },
            }
        rows.append(
            ParsedRow(line_no=line_no, raw=raw, normalized=normalized, errors=errors)
        )

    return rows, headers_captured
