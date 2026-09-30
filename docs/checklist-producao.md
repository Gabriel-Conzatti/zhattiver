# Checklist de produção

Use este documento como roteiro passo a passo para o primeiro deploy na VPS
e para cada atualização subsequente. Todos os comandos assumem execução na
raiz do repositório clonado em `/opt/lynk/app`.

## 1. Preparo do servidor

1. Sistema operacional Linux atualizado (Ubuntu 22.04 LTS recomendado).
2. Docker Engine + plugin Compose v2 instalados.
3. Firewall aberto para 80/443 (Caddy) — nada mais precisa ser exposto.
4. Domínio apontando para o IP da VPS (registros A/AAAA).
5. Diretórios de estado criados:
   ```bash
   sudo mkdir -p /opt/lynk /opt/lynk/backups
   sudo chown -R "$USER":"$USER" /opt/lynk
   ```

## 2. Configuração

1. Clonar o repositório em `/opt/lynk/app`.
2. `cp .env.example .env` e preencher:
   - `LYNK_DOMAIN` — domínio HTTPS público.
   - `LYNK_SECRET_KEY` e `LYNK_CSRF_SECRET` (gere valores aleatórios de 64+ chars).
   - `POSTGRES_PASSWORD` com senha forte (32+ chars sem espaço).
   - `LYNK_GUNICORN_WORKERS` conforme CPU (≈ `2 × núcleos + 1`).
   - `LYNK_SMTP_*` se recuperação de senha por email for necessária.
3. `chmod 600 .env`.
4. `docker compose config` — valida a composição sem subir nada.

## 3. Primeiro boot

```bash
docker compose up -d --build
docker compose ps
```

Todos os serviços devem sair de `starting` para `healthy` em até 60 segundos.
`web` fica sem healthcheck próprio, mas responde ao `curl -I https://$LYNK_DOMAIN`.

## 4. Bootstrap dos dados

```bash
docker compose exec api flask db upgrade
docker compose exec api flask lynk create-admin
```

`create-admin` semeia:
- catálogos (origens, tipos de cliente, seguradoras);
- produto Seguro Automóvel;
- funil default com 6 etapas e mensagem inicial;
- 7 motivos de perda e 7 tipos de próxima ação.

Depois entre pela URL pública, crie SDR/vendedores em `/admin/equipe` e associe
produtos. Cadastre `BonusRule` e `MonthlyGoal` pela API/UI antes de esperar
apuração de bônus.

## 5. Verificação

```bash
scripts/healthcheck.sh
curl -I https://$LYNK_DOMAIN
curl -I https://$LYNK_DOMAIN/api/v1/health
```

Também abra a SPA em navegador e confirme:
- Login com o admin criado.
- Sino de notificações apresenta contagem.
- Dashboard admin mostra os cinco contadores.
- CSP não bloqueia carregamento (verifique `docker compose logs -f web`).

## 6. Backup e restauração

- Backup automático via cron (`scripts/backup.sh`, ver `docs/backup-restore.md`).
- Faça um teste de restauração em ambiente separado antes de considerar o deploy validado.

## 7. Atualizações

Use o script guiado — ele fica idempotente e inclui backup imediato antes de subir versão nova:

```bash
scripts/deploy.sh
```

Etapas executadas: `git pull` → `pg_dump` gzip → `build` → `migrate` → `up -d --build`
para `api`, `worker`, `scheduler`, `web` → `healthcheck.sh`.

Rollback rápido:

```bash
git checkout <tag ou commit anterior>
docker compose up -d --build api worker scheduler web
# Se a migração da versão nova precisou ser desfeita, siga docs/backup-restore.md.
```

## 8. Rotação de segredos

1. Gere novos `LYNK_SECRET_KEY` e `LYNK_CSRF_SECRET`.
2. Atualize `.env` (e reinicie: `docker compose up -d --no-deps api worker scheduler`).
3. Todas as sessões existentes serão invalidadas — comportamento esperado.
4. Registre a rotação no operador de mudança.

## 9. Observabilidade

- Todos os serviços logam em JSON estruturado (formato aplicado em `web`, `api`, `worker`, `scheduler`).
- Logs rotacionados em disco (`max-size 10m` × 5 arquivos por serviço via `logging` no Compose).
- Correlacione eventos com `request_id` — devolvido no header `X-Request-ID` e presente nos logs de `api`.

## 10. Segurança operacional

- Portas expostas ao público: 80 e 443 (Caddy). Banco, Redis e API só existem na rede interna do Compose.
- `SESSION_COOKIE_SECURE=true` em produção; sessão em Redis com `Flask-Session` (dados fora do cliente).
- CSRF double-submit exigido em toda mutação; cookies com `SameSite=Lax` e `HttpOnly`.
- Headers de segurança aplicados pelo Caddy: HSTS 2 anos, CSP restritiva, X-Content-Type-Options, X-Frame-Options DENY, Permissions-Policy sem geolocalização/câmera/microfone.
- `ProxyFix` aceita apenas 1 salto de proxy (Caddy) para evitar spoofing de IP externo.

## 11. Limitações conhecidas

- Rate limiting em `/auth/login` ainda não está implementado (usar fail2ban/Caddyfile custom se exposto à internet aberta).
- Painel administrativo de funis/etapas ainda não tem UI (funis padrão via `create-admin`; endpoints existem).
- Job `generate_daily_followups` roda uma vez às 6h local — no primeiro dia execute manualmente para popular:
  ```bash
  docker compose exec worker celery -A app.jobs.celery_app call app.jobs.tasks.generate_daily_followups
  ```
