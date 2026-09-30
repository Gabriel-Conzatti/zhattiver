# Lynk

Sistema de gestão de prospecção e novos negócios para corretora de seguros.
Monólito modular: frontend React + backend Flask + PostgreSQL + Redis + Celery, orquestrado por Docker Compose e servido em produção via Caddy.

Este repositório está sendo construído em etapas verificáveis. Consulte:

- `PROGRESS.md` — o que já foi entregue, o que falta e o próximo passo.
- `docs/requisitos.md` — matriz das RN-001..RN-087 e permissões (MP-001..MP-006).
- `docs/decisoes.md` — decisões técnicas e hipóteses provisórias com destaque para revisão.
- `docs/arquitetura.md` — arquitetura macro e limites do produto.
- `docs/modelo-dados.md` — modelo de dados e integridade.
- `docs/deploy-vps.md`, `docs/backup-restore.md`, `docs/operacao.md` — implantação, backup e operação em VPS.
- `docs/checklist-producao.md` — checklist passo a passo para o primeiro deploy e para atualizações.
- `docs/referencias/` — coloque aqui os PDFs e imagens de referência quando disponíveis.

## Requisitos

- Docker Desktop / Docker Engine + Docker Compose plugin.
- Para desenvolvimento fora do Docker: Python 3.12, Node 20 LTS.

## Como rodar em desenvolvimento (Docker)

```powershell
Copy-Item .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Serviços expostos localmente:

- Frontend (Vite dev server): http://localhost:5173
- API Flask: http://localhost:5000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Antes do primeiro acesso, crie o administrador inicial:

```powershell
docker compose exec api flask lynk create-admin
```

## Como rodar em desenvolvimento (sem Docker)

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:FLASK_APP = "wsgi:app"
$env:LYNK_ENV = "development"
flask db upgrade
flask run --port 5000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Testes

Backend:

```powershell
cd backend
pytest
```

Frontend:

```powershell
cd frontend
npm run test
npm run build
npm run typecheck
```

Testes E2E (Playwright) — exigem a stack rodando:

```powershell
cd frontend
npm run test:e2e:install   # apenas na primeira vez
$env:LYNK_E2E_ADMIN_EMAIL = "admin@example.com"
$env:LYNK_E2E_ADMIN_PASSWORD = "..."
npm run test:e2e
```

## Produção (VPS)

Consulte `docs/checklist-producao.md` (checklist passo a passo) e `docs/deploy-vps.md`. Comandos resumidos:

```bash
cp .env.example .env  # preencha os valores reais
docker compose -f compose.yaml up -d --build
docker compose exec api flask db upgrade
docker compose exec api flask lynk create-admin
scripts/healthcheck.sh
```

Atualização subsequente:

```bash
scripts/deploy.sh
```

## Estrutura

```
backend/    # Flask + SQLAlchemy + Alembic + Celery
frontend/   # React + TS + Vite + Tailwind
infra/      # Caddyfile, configs de proxy
scripts/    # backup, restore, operação
docs/       # requisitos, decisões, arquitetura, operação, referências
compose.yaml         # base para produção
compose.dev.yaml     # override para desenvolvimento
.env.example         # variáveis documentadas
```
