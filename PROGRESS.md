# PROGRESS

Registro vivo do que foi implementado, o que está verificado e o que ainda falta.
Datas em `America/Sao_Paulo`. Só marque como "verificado" o que foi testado de verdade.

## Etapa atual

**Etapa 9 — Homologação em produção (deploy publicado; validação comercial em andamento)**

### Ajuste visual do login — 14/10/2026

- Aplicada a referência visual enviada para a tela de login: fundo em gradiente,
  logo no topo, formulário compacto em cartão escuro, campos arredondados e botão ciano.
- Removidos os seletores visuais de vendedor/SDR; o destino continua sendo definido pelo
  papel retornado pelo backend após a autenticação.
- Removido o acesso público à recuperação de senha da navegação; a redefinição administrativa
  em Equipe > Editar permanece como caminho operacional.
- O SVG fornecido foi incorporado em `frontend/public/logo-funil.svg` e passou a ser usado
  no login, no cabeçalho do vendedor/SDR e no menu administrativo.

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
  - `cancel_bonus` exige justificativa, impede cancelamento após pagamento e audita a transição.
  - `bonus_paid_for_sale_month` decide o `cancelled_kind` do cancelamento.
  - Metas e faixas validam vendedor/produto contra a organização da sessão; faixas
    sobrepostas são rejeitadas e vigências encerradas não podem ser reabertas.
- Permissões (grants opcionais): `sales.view_net_premium`, `sales.view_commission_pct`, `sales.view_commission_amount`, `sales.edit_after_deadline`, `sales.validate`, `bonus.view_own`.
- Rotas novas:
  - `POST /sales` (funil ou direta), `GET /sales`, `GET /sales/{id}`, `PATCH /sales/{id}` (grava revisão pendente quando cabível), `POST /sales/{id}/validate`, `POST /sales/{id}/cancel`.
  - `GET /me/production`, `GET /me/bonus` (respeitam MP-004 e configurações de visibilidade).
  - `GET/POST /monthly-goals`, `GET/POST /bonus-rules`, `PATCH /bonus-rules/{id}`.
  - `GET /admin/bonus?year=&month=`, `POST /admin/bonus/refresh`,
    `POST /admin/bonus/{id}/approve|pay|cancel`.
- Frontend:
  - `SaleFormDialog` reutilizável — venda direta (via botão `+` do topbar) ou venda pelo funil (via drawer "Ganhar"); campos obrigatórios com prévia da comissão calculada.
  - `AdminProducaoPage` — filtros por estado, badge, ações Validar/Cancelar (com justificativa).
  - `AdminBonusPage` — apuração por competência, metas por vendedor/produto,
    faixas versionadas, encerramento de vigência e ações Aprovar, Pagar e Cancelar.
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
  - `flask lynk seed-e2e` cria organização e usuários isolados por
    `LYNK_E2E_RUN_ID`, catálogos e disponibilidade inicial; o comando é bloqueado
    em produção e exige senha de teste explícita.
  - Os specs usam dados derivados do identificador da execução e não dependem de
    relógio nem da ordem entre arquivos.
  - A reprodução local dos sete cenários encontrou e corrigiu: rótulos sem
    associação acessível no formulário SDR, seleção incorreta da etapa inicial,
    corrida na criação da oportunidade e efeito duplicado do modal em React
    Strict Mode.
- Backend adiciona teste de smoke `test_health.py` cobrindo `/api/v1/health` sem exigir Postgres.
- CI: `.github/workflows/ci.yml` roda `pytest`, `npm typecheck`, `npm build`,
  `npm test`, valida `docker compose config` em prod/dev e possui job E2E com
  PostgreSQL 16, Redis 7, migrations, seed isolado e Chromium.

## Verificado

- Backend: `pytest` executado em `backend/` — 53 testes aprovados.
- Playwright: sete cenários aprovados em execução local isolada (login/logout,
  credencial inválida, cadastro/disponibilização/duplicidade SDR, cópia de
  mensagem e metas do vendedor).
- A CI do PR #1 confirmou os mesmos fluxos com PostgreSQL 16, Redis 7 e Chromium.
- O seed E2E também prepara uma venda pendente determinística; o fluxo administrativo
  valida a venda e confirma sua passagem para a produção oficial.
- A identidade visível do produto foi atualizada para **Funil Sustentare** no login,
  navegação, administração, título do navegador e favicon. Identificadores técnicos
  legados (`LYNK_*`, comando `flask lynk`) foram preservados por compatibilidade operacional.
- Cobertura de autorização adicionada em `backend/tests/test_authorization_boundaries.py`:
  SDR não acessa vendas nem oportunidades; vendedor só vê as próprias vendas; organização
  externa não localiza vendas; bônus sem concessão não expõe valor; listagem administrativa
  de bônus é isolada por organização; mutações autenticadas sem CSRF recebem `403` e, com
  token válido, são aceitas.
- Auditoria administrativa disponível em `GET /api/v1/audit`, com filtros exatos,
  paginação, ordenação determinística e isolamento por organização. A tela **Auditoria**
  permite ao administrador consultar e filtrar os registros sem alterá-los. A suíte de
  autorização cobre acesso exclusivo de administrador e evita exposição entre organizações.
- Configurações administrativas agora mantêm funis, etapas, ordem, etapa inicial/final,
  mensagens, motivos de perda e tipos de próxima ação. As mutações validam o tenant,
  preservam histórico por arquivamento/desativação e geram auditoria. A tela
  **Configurações** cobre carregamento, vazio, erro, sucesso e indisponibilidade.
- Serviços administrativos validam que origem/destino de transferências e usuário substituído
  em concessões pertençam à organização ativa. Agendamentos também validam lead, produto,
  responsável e origem antes da gravação.
- Lint dos arquivos backend alterados aprovado com `ruff check`.
- Verificador local único: `scripts/verify.ps1` executado com sucesso — pytest backend,
  typecheck/test/build frontend e configuração Compose de produção/desenvolvimento.
- Barreira de lint frontend restaurada com configuração flat do ESLint 9. Vite 6.4.3,
  Vitest 4.1.11 e Tailwind CSS 4.3.3 substituem versões com CVEs conhecidos; os scans
  finais do `appmod-cve-assessment` e `npm audit` não encontraram vulnerabilidades.
- Login protegido por rate limiting distribuído no Redis, com limites independentes por
  conta e IP, chaves HMAC sem PII em claro, `Retry-After` em bloqueios e falha fechada
  quando o Redis estiver indisponível. Testes cobrem bloqueio, limpeza após sucesso e `503`.
- Perfil disponível para vendedor, SDR e administrador, com nome editável e troca de senha
  protegida pela senha atual. A versão de sessão invalida acessos antigos após troca/reset,
  sem registrar senha ou hash na auditoria. Testes usam duas sessões simultâneas.
- CI do backend provisiona PostgreSQL 16, valida a migração inicial e executa os testes
  HTTP com `TEST_DATABASE_URL`; fora da CI, a fixture mantém fallback SQLite para
  desenvolvimento local.
- A infraestrutura E2E foi validada localmente e na CI com PostgreSQL 16,
  Redis 7 e Chromium.
- RN-038 verificada por teste de integração: somente vendas `validated` entram nos
  totais de produção usados pelas metas, na apuração de bônus e na descoberta de
  pares vendedor/produto. Vendas registradas, em revisão, canceladas ou de outro
  tenant permanecem fora da apuração.
- Relatório administrativo mensal de produção disponível com filtros por competência,
  vendedor e produto, totais de prêmio líquido e comissão, contagem por estado e
  agrupamento por vendedor/produto. A API é exclusiva de administrador, deriva o tenant
  da sessão e reutiliza a elegibilidade RN-038. RN-072 foi verificada em vendas, bônus,
  notificações e relatórios.
- Configurações administrativas agora cobrem produtos, origens, tipos de cliente,
  seguradoras, categorias de tag e tags. Itens podem ser criados, renomeados, arquivados
  e restaurados sem apagar o histórico; categorias de tag são validadas contra o tenant
  ativo e todas as mutações geram auditoria.
- Recuperação segura de senha disponível por email. A solicitação não revela contas,
  o token aleatório é persistido somente como hash SHA-256, expira em 30 minutos,
  aceita um único uso e invalida todas as sessões após a redefinição. Falhas de SMTP
  não expõem email ou token nos logs.
- Auditoria de interface corrigiu navegação móvel nos três perfis, controles inertes,
  colisão visual do token `base`, cards com destino conhecido e cache HTTP que podia
  restaurar a sessão visualmente após logout. As 23 rotas autenticadas foram verificadas
  em viewport de 390 px sem rolagem horizontal da página.
- Administrador pode cadastrar e disponibilizar leads pela própria tela de Prospecção,
  permitindo iniciar a operação sem criar um usuário SDR.
- A tela Equipe permite configurar a meta diária de prospecção do vendedor com início
  de vigência, preservação das vigências anteriores e auditoria. RN-005 foi coberta por
  testes backend e frontend.

## Pendente (próximas etapas)

- Polimento de longo prazo: dashboards adicionais e integração com WhatsApp Business
  Cloud API para envio real de mensagens.
- Homologação comercial assistida no domínio público para transformar as marcações
  `🟨` de `docs/requisitos.md` em `✅`.
- Concluir a autenticação SMTP com uma senha exclusiva da caixa Locaweb e validar o
  recebimento. DNS, endpoint `email-ssl.com.br:587`, STARTTLS e conectividade da VPS já
  foram verificados; o configurador seguro está em `/root/configure-smtp.py`. Não é
  bloqueador: a redefinição administrativa de senha já foi validada em produção.
- Cadastrar `MonthlyGoal` e `BonusRule` (hoje zerados) antes de qualquer apuração.
- Informar na tela Equipe a meta diária de prospecção da vendedora; o valor é uma
  definição comercial e não deve ser inventado na implantação.
- Usuário SDR foi retirado do escopo imediato por decisão da operação. O administrador
  cobre cadastro e disponibilização de leads; o perfil poderá ser criado futuramente.

## Deploy de produção — 14/10/2026

Publicado em `funil.zhattiver.com` a partir do commit `e23d4ae`.

- Versão inicial do deploy: `bfcfac7` (01/10/2026), atualizada para `c7733f3`.
- Fechamento funcional sem SDR publicado em `e23d4ae`.
- Backup pré-deploy verificado antes da atualização (`gzip -t` aprovado).
- Migrações aplicadas: `1ea62d17932e` → `8f28a73b9c11` → `4b7ac198d21e` → `6c9e0b4d7a12` (head).
- Serviços recriados: `api`, `worker`, `scheduler`, `web`. Todos saudáveis.
- `scripts/healthcheck.sh` aprovado; nenhum erro nos logs da API.
- Identidade pública confirmada como **Funil Sustentare** (o domínio ainda servia "Lynk").
- Bundle publicado idêntico ao build local (`index-DP9J2fHT.js`).

### Verificado em produção

- `GET /api/v1/health` responde `200`.
- `GET /api/v1/auth/me` sem sessão responde `401`.
- Rota inexistente da API responde `404`; rota desconhecida da SPA entrega o `index.html`.
- `GET` em rota de mutação responde `405` (nenhuma mutação por GET).
- Rate limiting real: bloqueio na 8ª tentativa inválida, com `Retry-After: 899`.
- Restauração do backup validada em banco separado (40 tabelas, dados íntegros) e descartada em seguida.
- Backup automático diário ativo via cron às 03h, com 10 dias de histórico.
- `generate_daily_followups` executado manualmente com sucesso (`{'created': 0}`, base sem oportunidades).
- Celery beat ativo com `close_daily_metas` e `generate_daily_followups` registrados.
- Apenas 80, 443 e 22 expostos no host; banco, Redis e API permanecem na rede interna.
- Certificado Let's Encrypt válido até 29/12/2026, TLS 1.3, com renovação ARI acompanhada pelo Caddy.
- SPA renderiza login e recuperação de senha sem violação de CSP.
- Login autenticado validado com conta administrativa descartável: painel, equipe,
  metas e bônus, configurações, notificações e auditoria carregaram corretamente.
- A conta descartável foi removida após o smoke test; a base voltou aos dois usuários
  originais e a sessão recebeu `401` com redirecionamento para o login.
- Redefinição administrativa de senha validada ponta a ponta sobre HTTPS com um par
  descartável de administrador e vendedor: `PATCH /api/v1/admin/users/<id>` com
  `reset_password` respondeu `200`, o vendedor autenticou com a nova senha e recebeu
  `403` ao tentar rota administrativa. A auditoria registrou os dois cadastros, a
  atualização e os dois logins. As contas foram removidas e passaram a responder `401`.
- Prospecção administrativa validada no domínio público: formulário de novo lead,
  origens, tipos de cliente, produto e ação de disponibilização carregaram com a sessão
  administrativa.
- Meta diária validada em produção com vendedor descartável: API gravou quota `17` com
  vigência, a tela Equipe exibiu o valor e a auditoria registrou a atualização. As duas
  contas e a quota temporárias foram removidas; a base voltou a 2 usuários e 0 quotas.

## Próximo passo

1. Definir, na tela Equipe, a meta diária de prospecção da vendedora.
2. Cadastrar metas mensais e faixas de bônus antes de qualquer apuração financeira.
3. Homologar os fluxos comerciais e marcar as RN confirmadas em `docs/requisitos.md`.
4. A recuperação de senha por e-mail foi **adiada por decisão da operação**: o sistema
   entra em produção sem SMTP e o caminho oficial para esquecimento de senha é a
   redefinição administrativa em Equipe > Editar, já validada em produção. Se a decisão
   for revista, basta criar uma senha exclusiva da caixa remetente na Locaweb e executar
   `python3 /root/configure-smtp.py` na VPS. O configurador valida a autenticação antes
   de alterar o `.env`, recria a API e dispara uma recuperação real.

## Limitações declaradas

- Produtos, tags, seguradoras, origens, tipos de cliente, funis, etapas, mensagens,
  motivos de perda, tipos de próxima ação, metas e faixas de bônus já possuem
  manutenção administrativa.
- Job de follow-ups é diário (6h local) — no primeiro deploy execute manualmente para popular as ações do dia:
  `docker compose exec worker celery -A app.jobs.celery_app call app.jobs.tasks.generate_daily_followups`.
- PDFs e imagens de referência não foram copiados para `docs/referencias/`.
