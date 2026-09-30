#!/usr/bin/env bash
set -euo pipefail

# Backup consistente do PostgreSQL rodando via Docker Compose.
# Uso: BACKUP_DIR=/opt/lynk/backups RETENTION_DAYS=14 ./scripts/backup.sh

BACKUP_DIR="${BACKUP_DIR:-/opt/lynk/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M)"
OUT="$BACKUP_DIR/lynk-$STAMP.dump"

echo "[lynk-backup] gerando $OUT"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-lynk}" -Fc "${POSTGRES_DB:-lynk}" > "$OUT"
gzip -f "$OUT" || true

echo "[lynk-backup] removendo backups com mais de $RETENTION_DAYS dias"
find "$BACKUP_DIR" -type f -name 'lynk-*.dump*' -mtime "+$RETENTION_DAYS" -print -delete

echo "[lynk-backup] concluído"
