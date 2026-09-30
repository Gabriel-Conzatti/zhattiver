#!/usr/bin/env bash
# Atualização segura em VPS: backup, migrações e rebuild com dependências saudáveis.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/lynk/app}"
BACKUP_DIR="${BACKUP_DIR:-/opt/lynk/backups}"

cd "$REPO_DIR"

if [[ ! -f .env ]]; then
  echo "[lynk-deploy] .env ausente em $REPO_DIR"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "[lynk-deploy] atualizando código"
git fetch --all
git checkout "${LYNK_DEPLOY_REF:-main}"
git pull --ff-only

echo "[lynk-deploy] backup pré-upgrade"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F-%H%M)"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" \
  > "$BACKUP_DIR/pre-upgrade-$STAMP.dump"
gzip -f "$BACKUP_DIR/pre-upgrade-$STAMP.dump"

echo "[lynk-deploy] construindo imagens"
docker compose build --pull

echo "[lynk-deploy] aplicando migrações"
docker compose up --no-deps --exit-code-from migrate migrate

echo "[lynk-deploy] recriando serviços"
docker compose up -d --no-deps --build api worker scheduler web

echo "[lynk-deploy] verificando saúde"
sleep 5
"$(dirname "$0")/healthcheck.sh"

echo "[lynk-deploy] concluído em $(date +%F' '%T)"
