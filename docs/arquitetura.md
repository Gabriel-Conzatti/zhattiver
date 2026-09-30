# Arquitetura macro

## Objetivo

Organizar todo o processo comercial anterior à contratação (entrada do lead → qualificação → prospecção → agendamento → funil → venda → cancelamento/reciclagem/cross-sell).

Não substitui sistemas de emissão de apólices, sinistros, cobrança ou renovação operacional.

## Topologia

```
                    ┌──────────────────────────────────┐
                    │             Caddy 2              │
                    │  HTTPS + estáticos + proxy /api  │
                    └────────────┬─────────────────────┘
                                 │
             ┌───────────────────┼───────────────────────┐
             ▼                                             ▼
     estáticos (SPA React)                       upstream interno
                                                      /api → api:5000
                                                          │
                    ┌─────────────────────────────────────┴──────────┐
                    ▼                                                ▼
             ┌────────────┐  publish → broker Redis DB1     ┌─────────────┐
             │ api        │────────────────────────────────►│ worker      │
             │ Flask+Gunicorn (rede interna)                │ Celery      │
             └─────┬──────┘◄──── SQL / sessão               └─────┬───────┘
                   │                                              │
                   ▼                                              ▼
             ┌────────────┐                              ┌─────────────┐
             │ PostgreSQL │◄──── SQL  ─── Alembic ──────►│  scheduler  │
             │ 16         │                              │ Celery Beat │
             └────────────┘                              └─────────────┘

                    ┌────────────┐
                    │ Redis 7    │  DB0 sessão + cache
                    └────────────┘  DB1 broker  DB2 result
```

Rede: apenas Caddy expõe portas 80/443 no host. `api`, `db`, `redis`, `worker`, `scheduler` só ficam na rede interna do Compose.

## Camadas de código

### Backend (monólito modular Flask)

- `app/__init__.py` — application factory (`create_app(config_name)`), registra Blueprints de cada módulo, extensões e handlers globais.
- `app/config.py` — carrega variáveis de ambiente e devolve classes de configuração por ambiente.
- `app/core/` — infraestrutura transversal:
  - `db.py` (SQLAlchemy + declarative base + timezone helpers)
  - `auth.py` (Flask-Login + Argon2)
  - `authz.py` (autorização centralizada com negação por padrão)
  - `errors.py` (handlers HTTP + envelope JSON)
  - `logging.py` (formatter estruturado sem PII)
  - `calendar.py` (dias úteis + feriados)
  - `audit.py` (helper para gravar auditoria em transação)
  - `csrf.py` (double submit token)
  - `time.py` (`now_utc`, `now_local`, `today_local`)
- `app/modules/<dominio>/` — cada domínio tem `routes.py`, `services.py`, `schemas.py`, `models.py` e `__init__.py` (Blueprint).
- `app/jobs/` — `celery_app.py` (factory Celery), `beat.py` (agenda), tasks.
- `app/cli/` — comandos `flask lynk ...` (`create-admin`, `seed-dev`).
- `migrations/` — Alembic gerenciado pelo Flask-Migrate.
- `tests/` — pytest com fixtures de banco (PostgreSQL de teste), relógio controlado e calendário fixo.

### Frontend (SPA React)

- `src/app/` — bootstrap, providers (QueryClient, Router, Auth), rotas por perfil.
- `src/features/` — pastas por domínio (`auth`, `dashboard`, `prospeccao`, `agendamentos`, `funil`, `vendas`, `metas`, `bonus`, `cross-sell`, `equipe`, `relatorios`, `configuracoes`, `importacoes`, `perfil`).
- `src/components/` — primitives (Button, Card, Input, Table, Drawer, Modal, Kanban) e componentes compartilhados (NavPill, Sidebar, TopBar).
- `src/lib/` — `http.ts` (fetch com CSRF), `queryClient.ts`, `schemas.ts`, `format.ts`, `date.ts`.
- `src/styles/` — `tokens.css`, `globals.css`, Tailwind config.

## Fluxo de request autenticado

1. Frontend faz `fetch('/api/v1/...')` com credenciais (`credentials: 'include'`).
2. Caddy encaminha para `api:5000`.
3. Flask valida cookie de sessão via Flask-Session (Redis).
4. `authz` decide com base em perfil + produto/equipe + vínculo com o registro + concessões vigentes.
5. Handler executa a regra em `services.py` dentro de transação e grava auditoria quando aplicável.
6. Resposta JSON com envelope padrão de erro `{ "error": { "code", "message", "details", "requestId" } }`.

## Padrões-chave

- Idempotência: rotas suscetíveis a retry aceitam `Idempotency-Key` (header ou body).
- Concorrência: `SELECT ... FOR UPDATE` ou constraints únicas para disputa de leads/oportunidades.
- Auditoria: gravada na mesma transação da operação. Nunca editável pela interface.
- Migrações: executadas por um serviço one-off (`migrate` no Compose) antes de subir versão dependente.
- Jobs: locks por chave em Redis + tabela de idempotência para tarefas críticas (fechamento diário, follow-ups, bônus).
- Config: cada regra (metas, faixas, mensagens, motivos) versionada por vigência; apurações antigas usam o snapshot da regra vigente no momento.

## Referências cruzadas

- Modelo de dados: `docs/modelo-dados.md`.
- Endpoints: `docs/api.md`.
- Deploy VPS: `docs/deploy-vps.md`.
- Backup/restore: `docs/backup-restore.md`.
- Operação diária: `docs/operacao.md`.
