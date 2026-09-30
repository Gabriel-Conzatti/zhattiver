# Deploy em VPS

Este guia é o roteiro operacional. Para o checklist passo a passo (com verificação
pós-boot), veja também `docs/checklist-producao.md`.

## Pré-requisitos

1. VPS Linux (Ubuntu 22.04+ recomendado).
2. Docker Engine + plugin `docker compose` instalados.
3. Domínio apontando (A/AAAA) para o IP da VPS.
4. Portas 80 e 443 liberadas para o Caddy.

## 1. Preparar diretórios e segredos

```bash
sudo mkdir -p /opt/lynk /opt/lynk/data/postgres /opt/lynk/data/redis /opt/lynk/data/caddy
sudo chown -R $USER:$USER /opt/lynk
cd /opt/lynk
git clone <URL_DO_REPO> app
cd app
cp .env.example .env
# Edite .env preenchendo LYNK_DOMAIN, LYNK_SECRET_KEY, LYNK_CSRF_SECRET, POSTGRES_PASSWORD.
chmod 600 .env
```

## 2. Subir a stack

```bash
docker compose config          # valida a composição
docker compose up -d --build   # sobe web/api/worker/scheduler/db/redis
docker compose ps
```

## 3. Migrações e administrador inicial

```bash
docker compose exec api flask db upgrade
docker compose exec api flask lynk create-admin
```

O comando pergunta email e senha (nunca via variável de ambiente). A senha é hashada com Argon2id.

## 4. Verificação

- `curl -I https://$LYNK_DOMAIN` deve retornar 200.
- `curl -I https://$LYNK_DOMAIN/api/v1/health` deve retornar 200.
- Fazer login pela SPA e confirmar `/api/v1/auth/me`.
- `docker compose logs -f api worker scheduler` deve estar limpo.

## 5. Atualizações

Use o script guiado (backup automático + build + migrate + recreate + healthcheck):

```bash
scripts/deploy.sh
```

Etapas manuais equivalentes:

```bash
cd /opt/lynk/app
git fetch --all
git checkout <tag ou commit>
docker compose exec db pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB \
  > /opt/lynk/backups/pre-upgrade-$(date +%F).dump
gzip /opt/lynk/backups/pre-upgrade-$(date +%F).dump
docker compose build --pull
docker compose up --no-deps --exit-code-from migrate migrate
docker compose up -d --build api worker scheduler web
scripts/healthcheck.sh
```

Nunca use `docker compose down -v` como atualização — remove volumes.

## 6. Integração com proxy existente

Se a VPS já usa Nginx/Traefik na porta 80/443:

- Configure este Compose para publicar `web` em uma porta interna (`127.0.0.1:8443:443`) ou remova o publish de 80/443 e use somente HTTP interno (Caddy escutando 8080).
- Aponte o proxy existente para essa porta.
- Ajuste `LYNK_TRUSTED_PROXIES` se necessário (a implementar).

## 7. Solução de problemas

- Erro de HTTPS: verifique `docker compose logs web` — Caddy pode estar bloqueado por rate limit do Let's Encrypt.
- Erro de banco: `docker compose logs db` e confirme que `DATABASE_URL` bate com credenciais.
- Falha de migração: rode `flask db current` e `flask db history`.
- Sessão não persiste: confirme `REDIS_URL` e volume do Redis.
