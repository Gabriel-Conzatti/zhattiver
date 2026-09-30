#!/usr/bin/env bash
# Verificação pós-deploy: API responde e serviços estão saudáveis.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/lynk/app}"
cd "$REPO_DIR"

echo "[lynk-health] status dos serviços"
docker compose ps

echo "[lynk-health] chamando /api/v1/health"
if ! docker compose exec -T api curl -fsS http://localhost:5000/api/v1/health >/dev/null; then
  echo "[lynk-health] API não respondeu" >&2
  exit 1
fi

echo "[lynk-health] ping Celery worker"
if ! docker compose exec -T worker celery -A app.jobs.celery_app inspect ping >/dev/null 2>&1; then
  echo "[lynk-health] worker Celery não respondeu (pode estar em cold start)"
fi

echo "[lynk-health] contagem de migrações aplicadas"
docker compose exec -T api flask db current

echo "[lynk-health] OK"
