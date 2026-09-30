#!/usr/bin/env bash
set -euo pipefail

# Restaura um dump em um banco alternativo para verificação.
# Uso: ./scripts/restore.sh /caminho/lynk-YYYY-MM-DD.dump[.gz] target_db_name

DUMP="${1:?informe o caminho do dump}"
TARGET_DB="${2:?informe o nome do banco de destino}"

if [[ "$DUMP" == *.gz ]]; then
  TMP="$(mktemp)"
  gunzip -c "$DUMP" > "$TMP"
  DUMP="$TMP"
fi

createdb -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-lynk}" "$TARGET_DB" || true
pg_restore -h "${PGHOST:-127.0.0.1}" -U "${PGUSER:-lynk}" -d "$TARGET_DB" \
  --clean --if-exists "$DUMP"

echo "[lynk-restore] concluído em $TARGET_DB"
