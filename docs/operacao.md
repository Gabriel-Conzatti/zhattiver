# Operação diária

## Verificação de saúde

Use o script guiado para validar API, worker e migrações:

```bash
scripts/healthcheck.sh
```

## Logs

```bash
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f scheduler
docker compose logs -f web
```

Logs da aplicação são JSON estruturado (sem PII sensível). Correlacionar por `request_id` (header `X-Request-ID`).
Rotação de arquivos configurada no Compose (`json-file`, `max-size 10m`, 5 arquivos por serviço).

## Métricas rápidas

```bash
docker compose exec db psql -U $POSTGRES_USER $POSTGRES_DB -c "SELECT COUNT(*) FROM opportunities WHERE state='open';"
docker compose exec db psql -U $POSTGRES_USER $POSTGRES_DB -c "SELECT DATE(occurred_at), COUNT(*) FROM activities GROUP BY 1 ORDER BY 1 DESC LIMIT 7;"
```

## Reiniciar serviços com segurança

```bash
docker compose restart api worker scheduler
```

Reinício de `worker`/`scheduler` **não** perde tarefas: jobs críticos usam locks + idempotência (RN + seções de operação).

## Executar tarefa periódica manualmente

```bash
docker compose exec worker celery -A app.jobs.celery_app call app.jobs.tasks.close_daily_metas
```

## Bloquear usuário

```bash
docker compose exec api flask lynk deactivate-user --email alguem@corretora.com
```

## Rotação de segredos

1. Gere novos valores fortes de `LYNK_SECRET_KEY` e `LYNK_CSRF_SECRET`.
2. Atualize `.env`.
3. `docker compose up -d --no-deps api worker scheduler` para recarregar.
4. Todas as sessões ativas serão invalidadas (comportamento esperado).

## Diagnóstico de disputa de leads

- Consulte `activities` filtrando por `type='copy_message'` e `idempotency_key`.
- Concorrência é resolvida por constraint única + `SELECT ... FOR UPDATE` no serviço; se aparecerem duplicados, é bug crítico — abrir issue com `request_id`.

## Encerramento diário (RN-003)

Configurado no Beat para rodar às 19h `America/Sao_Paulo`. Se não executar por falha:

```bash
docker compose exec worker celery -A app.jobs.celery_app call app.jobs.tasks.close_daily_metas --args='["YYYY-MM-DD"]'
```

O cálculo usa o intervalo real, não o horário do retry.
