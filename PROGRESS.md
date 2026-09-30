# PROGRESS

Registro vivo do que foi implementado, o que está verificado e o que ainda falta.
Datas em `America/Sao_Paulo`. Só marque como "verificado" o que foi testado de verdade.

## Etapa atual

**Etapa 8 — Entrega para VPS (produção endurecida, deploy scriptado, testes E2E, CI)**

## Concluído

### Etapa 1 — Diagnóstico e base

Base do projeto, docs, backend factory + core, frontend base, Docker Compose, Alembic bootstrap.

### Etapa 3 — Entrada e SDR

Leads + telefones normalizados + veículos + catálogos + disponibilizações; importação CSV/XLSX com staging e sanitização.

### Etapa 4 — Rotina inicial

Funil semeado, `copy_message` idempotente, regras de janela de agendamento (5–7 dias úteis, limite 2), resolução com justificativa + reagendamento, metas diárias em tempo real.

### Etapa 5 — Negociação

- Modelos: `LossReason`, `NextActionType` (configuráveis); campos de perda (`loss_reason_id`, `loss_justification`) e reciclagem (`recycled_to_schedule_id`) em `Opportunity`; `NextAction` ganhou `notes`, `done_at`, `done_activity_id`.- Serviço amplo:
  - `win_opportunity` / `lose_opportunity` (RN-053/054/055 — motivo obrigatório + justificativa mínima), fecha próximas ações abertas, grava atividade `result` na timeline.
  - `record_manual_activity` para contato/ligação/resposta/observação (RN-019/024) — reinicia `last_relevant_at` e marca automaticamente a próxima ação aberta mais próxima como cumprida.
  - `change_stage` (RN-024) — mudança livre para qualquer etapa do mesmo funil, grava atividade `stage_change`.
  - `create_next_action` / `mark_next_action_done` (RN-018/022) — idempotência opcional via `generation_key`.
  - `recycle_opportunity` (RN-056..059) — cria agendamento vinculado à tentativa anterior; `suggest_recycle_date` cobre 29/02 e coberto por teste.
  - `compute_pending_followups` (RN-016/017/018/020) — usa `follow_up_due_date` do calendário; ignora oportunidades com próxima ação aberta; itens vencidos permanecem até serem tratados sem duplicar.
  - `generate_daily_followups` — materializa em `NextAction` (`origin=auto`) via chave estável por oportunidade+dia, seguro para reexecução.
  - `compute_daily_goals` agora inclui follow-ups: alvo = pendentes hoje + atrasados; feito = oportunidades com atividade relevante hoje (RN-021).
- Rotas novas:
  - `POST /opportunities/{id}/stage`
  - `POST /opportunities/{id}/activities`
  - `POST /opportunities/{id}/next-actions`
  - `POST /next-actions/{id}/done`
  - `POST /opportunities/{id}/recycle`
  - `POST /opportunities/{id}/lose` agora exige `loss_reason_id` + `justification`
  - `GET /opportunities/{id}` — detalhe com etapas, atividades e próximas ações
  - `GET /me/followups`
  - `GET /loss-reasons`, `GET /next-action-types`
- Job Celery **diário às 6h** `generate_daily_followups` (idempotente).
- CLI `create-admin` agora também semeia motivos padrão de perda (Preço, Renovou com concorrente, Sem interesse, Não respondeu, Dados inválidos, Não foi possível cotar, Outro) e tipos de próxima ação (Mensagem, Ligação, Retorno, Reunião, Enviar cotação, Cobrar resposta, Outro).
- Frontend:
  - `OpportunityDrawer` — timeline, mudança de etapa por clique em pílula, botões de contato/ligação/resposta/observação com texto opcional, criação e conclusão de próxima ação, botões Ganhar/Reagendar/Perder com diálogos dedicados.
  - `LoseDialog` — motivo obrigatório + justificativa mínima.
  - `RecycleDialog` — data pré-preenchida com mesmo dia/mês do próximo ano (RN-057), opção "Data confirmada".
  - `NextActionDialog` — tipos carregados de `/next-action-types`.
  - Nova página `FollowupsPage` no vendedor (pendentes + programadas), integrada ao drawer.
  - Vendedor Dashboard passa a listar follow-ups pendentes; funil vira interativo (clique abre o drawer).

### Testes automatizados adicionados

- `tests/test_recycle.py` — `suggest_recycle_date` cobre ano seguinte com 29/02 → 28/02.
- Testes anteriores da Etapa 4 continuam válidos (janela, limite, resolver, aguardar; renderização de template).

### Etapa 6 — Resultado comercial

- Modelos: `Sale`, `SaleRevision`, `MonthlyGoal`, `BonusRule`, `BonusPayment`.
- Serviço de vendas:
  - `calc_commission` (RN-033) usa `Decimal` × `Decimal` com `ROUND_HALF_UP` (teste `R$ 2.000 × 15% = R$ 300,00`).
  - `compute_edit_deadline` (RN-034) usa `next_business_day` do calendário; deadline = fim do dia local do próximo útil (teste sexta 16h UTC → 23h59 seg local).
  - `create_sale` cria a venda + ganha a oportunidade na mesma transação (RN-030); venda direta funciona sem `opportunity_id` (RN-031).
  - `edit_sale` respeita o prazo, permite grant `sales.edit_after_deadline` (RN-035) e cria `SaleRevision` pendente quando o vendedor edita venda já validada (decisão provisória RN-034); admin edita direto e invalida.
  - `validate_sale` (RN-036/037) reaplica revisões pendentes antes de marcar validada; recalcula comissão; grava auditoria.
  - `cancel_sale` (RN-039..042) grava `cancelled_kind` = `before_bonus` ou `after_bonus` conforme já haja pagamento; sempre exige justificativa mínima; venda preservada no histórico.
- Serviço de bônus:
  - `predicted_payment_date` (RN-039) = dia 20 do mês seguinte (teste).
  - `compute_bonus_for_month` seleciona apenas vendas `validated` do mês; escolhe faixa vigente por `bracket_min <= metric <= bracket_max`; aplica fixo ou percentual.
  - `next_bracket_hint` alimenta o "faltam X" no dashboard.
  - `get_or_create_prediction` mantém snapshot `predicted`/`approved` vivo com a apuração atual; congela após pagamento (RN-041).
  - `mark_bonus_paid` grava `paid_at`, `paid_amount` e trava o snapshot.
  - `bonus_paid_for_sale_month` decide o `cancelled_kind` do cancelamento.
- Permissões (grants opcionais): `sales.view_net_premium`, `sales.view_commission_pct`, `sales.view_commission_amount`, `sales.edit_after_deadline`, `sales.validate`, `bonus.view_own`.
- Rotas novas:
  - `POST /sales` (funil ou direta), `GET /sales`, `GET /sales/{id}`, `PATCH /sales/{id}` (grava revisão pendente quando cabível), `POST /sales/{id}/validate`, `POST /sales/{id}/cancel`.
  - `GET /me/production`, `GET /me/bonus` (respeitam MP-004 e configurações de visibilidade).
  - `GET/POST /monthly-goals`, `GET/POST /bonus-rules`.
  - `GET /admin/bonus?year=&month=`, `POST /admin/bonus/refresh`, `POST /admin/bonus/{id}/approve`, `POST /admin/bonus/{id}/pay`.
- Frontend:
  - `SaleFormDialog` reutilizável — venda direta (via botão `+` do topbar) ou venda pelo funil (via drawer "Ganhar"); campos obrigatórios com prévia da comissão calculada.
  - `AdminProducaoPage` — filtros por estado, badge, ações Validar/Cancelar (com justificativa).
  - `AdminBonusPage` — seletor mês/ano, botão Recalcular, ações Aprovar e Marcar pago; explica RN-039/041.
  - Vendedor Dashboard mostra produção do mês, meta, faixa próxima e bônus previsto conforme visibilidade autorizada.
  - Drawer da oportunidade: botão "Ganhar" abre `SaleFormDialog`; o backend cuida de win + venda + auditoria na mesma transação.

### Testes automatizados adicionados (Etapa 6)

- `tests/test_sales.py` — comissão canônica RN-033, arredondamento HALF_UP, `compute_edit_deadline` (sexta 16h UTC → segunda 23h59 local), `predicted_payment_date` dia 20 do mês seguinte.

### Etapa 7 — Gestão

- Modelos: `Absence`, `CrossSellList`, `CrossSellItem`, `Notification`.
- Serviço de gestão:
  - `create_absence` (RN-067) + notificação para o substituto (RN-084).
  - `transfer_workload` transfere `Schedule` ativos e `NextAction` abertos (opcionalmente `Opportunity` abertas) do usuário origem para o destino em uma transação, com auditoria e notificação ao destinatário (RN-083).
- Serviço de cross-sell:
  - `generate_list` (RN-060..063) — filtros `has_product_ids`, `lacks_product_ids`, `include_unknown` (RN-064 sobre "possui" vs "desconhecido"); grava `last_contact_at` de cada candidato (RN-064).
  - `release_items` cria `Availability` para o produto alvo — total ou parcial (RN-063); marca `state=partial|released` na lista.
- Serviço de notificações:
  - `notify` com `dedup_key` (evita repetidos por usuário).
  - `notify_admins` publica para todos os administradores da organização.
  - Gatilhos: SDR disponibiliza lead → admins (RN-081), venda registrada → admins (RN-082), transferência → destinatário (RN-083), ausência → substituto (RN-084).
- Rotas admin:
  - `GET/POST /admin/users`, `PATCH /admin/users/{id}` (nome, perfil, ativo, produtos autorizados, reset de senha); bloqueia rebaixar/desativar o próprio admin.
  - `GET/POST /admin/grants`, `POST /admin/grants/{id}/revoke` (concessões temporárias MP-005/006). Rejeita permissões que envolvam bônus de outros vendedores (MP-004).
  - `GET/POST /admin/absences`, `POST /admin/transfers`.
  - `GET/POST /admin/cross-sell/lists`, `GET /admin/cross-sell/lists/{id}`, `POST /admin/cross-sell/lists/{id}/release`.
  - `GET /admin/dashboard` — contadores consolidados.
- Notificações do usuário logado: `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- Frontend:
  - `NotificationBell` reutilizável no TopBar (vendedor/SDR) e no header do AdminLayout; polling de 30s + contador de não lidas; clique marca como lida e navega para `link_path`.
  - `AdminDashboard` real (leads, oportunidades, vendas pendentes, agendamentos ativos, usuários ativos).
  - `AdminUsuariosPage` — criar, editar (nome/perfil/ativo/produtos/reset de senha), badge de estado.
  - `AdminAusenciasPage` — formulário + listagem + painel de transferência em massa (agendamentos, follow-ups, opcionalmente oportunidades).
  - `AdminConcessoesPage` — criar concessão com permissão selecionável, substituindo opcional, vigência início/fim, motivo; revogar em um clique.
  - `AdminCrossSellPage` — construtor visual de filtros por produtos (has/lacks), gera pré-lista, revisão dos candidatos com estado e último contato, "Liberar selecionados" ou "Liberar todos".
  - Sidebar admin reorganizada (Comercial: Dashboard/Prospecção/Cross-Sell; Gestão: Produção/Bônus/Equipe/Ausências/Concessões).

### Etapa 8 — Entrega para VPS

- Backend: `ProxyFix` ativado somente em produção (1 salto, aceita `X-Forwarded-*` do Caddy interno).
- `backend/Dockerfile` com `HEALTHCHECK` interno via `curl /api/v1/health`.
- `compose.yaml`:
  - `logging` padronizado em JSON com `max-size 10m` e 5 arquivos por serviço.
  - `worker` recebe healthcheck via `celery inspect ping`.
  - `gunicorn` inicia com `--forwarded-allow-ips "*"` (rede interna do Compose).
- Caddyfile endurecido:
  - `trusted_proxies static private_ranges`.
  - Handler `/api/*` preserva o prefixo e propaga `X-Request-ID`.
  - Content-Security-Policy restritiva compatível com a SPA + `frame-ancestors 'none'`.
  - Log JSON estruturado.
- Scripts operacionais:
  - `scripts/deploy.sh` — pull, backup, build, migração one-off (`--exit-code-from`), rebuild sem `down`, healthcheck.
  - `scripts/healthcheck.sh` — status dos serviços, `/health`, ping ao worker Celery, `flask db current`.
- Documentação:
  - `docs/checklist-producao.md` (novo) — checklist passo a passo de deploy, backup, rotação de segredos, observabilidade, limitações.
  - `docs/deploy-vps.md` e `docs/operacao.md` alinhados aos novos scripts.
  - `README.md` documenta `scripts/deploy.sh`, `scripts/healthcheck.sh` e o comando de E2E.
- Testes E2E (Playwright):
  - `playwright.config.ts` com locale pt-BR e timezone `America/Sao_Paulo`.
  - `e2e/login.spec.ts` — login admin, logout, credenciais inválidas.
  - `e2e/sdr-flow.spec.ts` — cadastro + disponibilização + duplicidade por telefone.
  - `e2e/vendedor-flow.spec.ts` — "Copiar mensagem" registra atividade + presença das metas do dia.
- Backend adiciona teste de smoke `test_health.py` cobrindo `/api/v1/health` sem exigir Postgres.
- CI: `.github/workflows/ci.yml` roda `pytest`, `npm typecheck`, `npm build`, `npm test` e valida `docker compose config` em prod e dev.

## Verificado

- Nada foi executado neste ambiente. Rode `pytest`, `npm run test`, `npm run build`, `docker compose config` manualmente.

## Pendente (próximas etapas)

- Polimento de longo prazo (fora do escopo das oito etapas): UI para CRUD de funis/motivos/tags, rate limiting em `/auth/login`, dashboards de relatórios agregados, integração com WhatsApp Business Cloud API para envio real de mensagens.
- Executar `pytest`, `npm run test`, `npm run build`, `docker compose config` e `scripts/deploy.sh` na VPS real para transformar as marcações `🟨` em `✅`.

## Próximo passo

1. Provisione a VPS (Ubuntu 22.04+, Docker + Compose v2, DNS apontado).
2. Clone o repositório em `/opt/lynk/app` e siga `docs/checklist-producao.md`.
3. Após o boot, rode `scripts/healthcheck.sh` e execute `npm run test:e2e` a partir de uma máquina cliente com `LYNK_E2E_BASE_URL` apontando para o domínio.
4. Configure `cron` diário para `scripts/backup.sh` e verifique restauração em ambiente separado (`docs/backup-restore.md`).
5. Marque os itens `🟨` de `docs/requisitos.md` como `✅` conforme cada fluxo for confirmado em produção.

## Limitações declaradas

- CRUD de produtos, funis, motivos e tipos ainda usa apenas o seed inicial do CLI (a UI cobre usuários, ausências, concessões, cross-sell). Endpoints administrativos existem para funil/tags/motivos/bonus-rules; UI dedicada para esses cadastros é polimento para a Etapa 8.
- Job de follow-ups é diário (6h local) — no primeiro deploy execute manualmente para popular as ações do dia:
  `docker compose exec worker celery -A app.jobs.celery_app call app.jobs.tasks.generate_daily_followups`.
- PDFs e imagens de referência não foram copiados para `docs/referencias/`.
