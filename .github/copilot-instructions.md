# Instruções permanentes do projeto Lynk

Use as regras abaixo como base para qualquer edição neste repositório. Consulte também:

- `docs/requisitos.md` — matriz de requisitos RN e MP.
- `docs/decisoes.md` — decisões e hipóteses provisórias.
- `docs/arquitetura.md` — arquitetura macro.
- `docs/modelo-dados.md` — modelo de dados.
- `PROGRESS.md` — progresso atual e próximo passo.

## Princípios

- Autorização centralizada no backend, negação por padrão. Frontend adapta a interface, nunca é a única proteção.
- "Poder encontrar não significa poder trabalhar, e poder trabalhar não significa poder ver finanças."
- Preservar histórico. Registros comerciais são arquivados, não excluídos.
- Configuração antes de código fixo: regras com vigência versionada.
- Dinheiro em `Decimal`/`NUMERIC`. Instantes em UTC, apresentação em `America/Sao_Paulo`.
- Nenhum vendedor visualiza bônus de outro vendedor, em nenhum caminho (URL, filtros, notificações, cache).
- Meta operacional diária fecha às 19h. Histórico considera o dia civil inteiro até 23h59:59.999999.
- Follow-up automático (RN-016/017): 24h corridas + próximo dia útil estritamente posterior.
- Janela de agendamentos: 5 a 7 dias úteis antes da data final da vigência (RN-009).
- Limite para abordagem: RN-011 = 2 dias antes da vigência. Unidade seguindo `docs/decisoes.md`.
- Prazo de edição de venda pelo vendedor: até 23h59 do próximo dia útil após o registro (RN-034).
- Comissão calculada no backend: `prêmio líquido × percentual` (percentual armazenado como número inteiro-like dividido por 100 no cálculo).
- Toda operação relevante gera auditoria: ator, data/hora, entidade, ação, valores anteriores/novos permitidos.

## Stack fixa

- Backend: Python 3.12, Flask, SQLAlchemy, Alembic (Flask-Migrate), Pydantic, Flask-Login, Flask-Session (Redis), Celery, Gunicorn.
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Lucide React.
- Infra: PostgreSQL 16, Redis 7, Caddy 2, Docker Compose.

## Convenções

- Rotas em `backend/app/modules/<dominio>/routes.py`, regras em `services.py`, modelos em `models.py`, schemas em `schemas.py`.
- Nunca aceitar `organization_id` vindo do cliente. Derivar sempre da sessão.
- Idempotência em ações repetíveis (copiar mensagem, confirmar contato).
- Frontend em português do Brasil. Datas `dd/MM/yyyy`, valores em real, telefones com formatação local.
- Estados obrigatórios de UI: carregando, vazio, erro, sucesso, indisponibilidade.

## Segurança

- Senhas com Argon2id. Sessão em cookie `HttpOnly`, `Secure` (produção), `SameSite=Lax`.
- CSRF em operações autenticadas por cookie. Nenhuma mutação por GET.
- Nenhum segredo no repositório. `.env` e Compose secrets.
- Logs sem PII sensível, sem senhas/tokens/cookies.

## Fluxo ao editar

1. Leia `docs/requisitos.md` para localizar a RN afetada.
2. Se a mudança tocar regra comercial, atualize `docs/requisitos.md` e `PROGRESS.md`.
3. Adicione teste (backend `pytest`, frontend `vitest` ou `playwright` quando fluxo crítico).
4. Verifique com `pytest`, `npm run test`, `npm run build`, `docker compose config` conforme o escopo.
