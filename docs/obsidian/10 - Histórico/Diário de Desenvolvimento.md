# Diário de Desenvolvimento

## 2026-10-16 - Hardening de segurança

### Realizado

- Corrigidos controles de propriedade de oportunidade e replay de idempotência.
- Corrigida normalização do IP no rate limit de login; Caddy não inclui a porta de origem.
- Invalidação robusta de sessões após mudança de perfil/estado e rejeição de contas
  desativadas.
- Validada a organização para FKs de vendas, disponibilizações e tarefas de sinistros.
- Segredos de produção e nomes de ambiente inválidos agora interrompem o boot.
- Atualizadas dependências Python com CVEs reportadas.

### Arquivos principais

- `backend/app/core/session_security.py`
- `backend/app/core/login_rate_limit.py`
- `backend/app/modules/opportunities/services.py`
- `backend/app/modules/sales/services.py`
- `backend/app/modules/leads/routes.py`
- `backend/app/modules/claims/services.py`
- `backend/app/config.py`
- `infra/caddy/Caddyfile`

### Testes executados

- `pytest -q` — 100 aprovados.
- Ruff — aprovado.
- `pip-audit -r requirements.txt` — nenhuma vulnerabilidade conhecida.

### Resultado

- Correções locais em `fix/security-hardening`; sem commit, push ou deploy de código.
- SSH root por chave, fail2ban e regras UFW minimas aplicados e verificados na VPS.
- Codigo em branch local; producao aguarda push/deploy para receber as correcoes da aplicacao.

### Próximos passos

- Aplicar hardening SSH e UFW mantendo acesso por chave validado.
- Rodar configuração do Compose e fechar a verificação da VPS.

## 2026-10-16 - Perfil exclusivo de sinistros

### Realizado

- Adicionado o perfil-base `sinistros` para usuários sem função comercial.
- O seletor de perfis permite remover Vendedor/SDR depois de marcar Sinistros.
- Criada a área `/area-sinistros`, com navegação restrita ao módulo, perfil pessoal,
  notificações e logout.
- Adicionada allowlist central no backend; qualquer outra API retorna `403`.
- O backend rejeita perfil exclusivo sem `claims.read` ou `claims.manage`.

### Arquivos principais

- `backend/app/core/role_scope.py`
- `backend/app/modules/users/models.py`
- `backend/app/modules/admin/routes.py`
- `frontend/src/features/admin/AdminUsuariosPage.tsx`
- `frontend/src/features/sinistros/SinistrosLayout.tsx`
- `frontend/src/app/App.tsx`

### Testes executados

- `pytest -q` — 88 aprovados.
- `npm test -- --run` — 47 aprovados.
- Ruff, ESLint, typecheck e build — aprovados.

### Resultado

- Publicado em produção em 2026-10-16 com o commit `a2492fb`.
- O deploy fez backup, manteve a migration `b4c91e8d2f60` e recriou os serviços.
- Usuário temporário de homologação: login 200, Sinistros 200, perfil pessoal 200 e
  Leads 403. A conta e a concessão foram removidas, com contagem final zero.
- Health e SPA responderam 200; o bundle `index-BFHeSz7m.js` contém a rota
  `/area-sinistros`.

### Próximos passos

- Homologar o perfil exclusivo com o usuário real da equipe de sinistros.

## 2026-10-16 - Perfis combináveis no cadastro de usuários

### Realizado

- O campo isolado "Acesso a sinistros" virou o seletor **Perfis**, reunindo Vendedor, SDR,
  Administrador e Sinistros no mesmo grupo visual.
- Vendedor e SDR permanecem mutuamente exclusivos; Sinistros é marcável junto de qualquer
  um dos dois.
- O nível Consulta/Operação só é exibido quando Sinistros está selecionado.
- Contrato do backend preservado: o perfil comercial continua em `role` e a função de
  sinistros continua em `claims_access`, sem migration nova.

### Arquivos principais

- `frontend/src/features/admin/AdminUsuariosPage.tsx`
- `frontend/src/features/admin/AdminUsuariosPage.test.tsx`

### Testes executados

- `npm test -- --run` — 46 aprovados.
- `pytest tests/test_admin_claims_access.py tests/test_claims.py` — 9 aprovados.
- ESLint, typecheck e build — aprovados.

### Resultado

- Publicado em produção em 2026-10-16 com o commit `ae39b79`. Apenas o serviço `web` foi
  recriado, porque a mudança é exclusiva de frontend.
- Verificado em produção: `/api/v1/health` e SPA em 200, e o bundle servido
  (`index-Nz4_WfOt.js`) corresponde ao build validado localmente.

### Próximos passos

- Homologar a combinação Vendedor + Sinistros com um usuário real.

## 2026-10-15 - Catálogos, oficinas e autorização de sinistros

### Realizado

- Adicionados os ramos Auto, RE e RCO ONIBUS e as 14 seguradoras solicitadas, incluindo
  Suhai, com isolamento por organização.
- Criado cadastro de oficinas com telefone, endereço, responsável e relação N:N com
  seguradoras referenciadoras.
- Novos sinistros passaram a selecionar ramo, seguradora e oficina por catálogo; o backend
  valida a compatibilidade oficina/seguradora e preserva nomes históricos.
- Removida a leitura implícita por perfil vendedor. O acesso exige `claims.read` ou
  `claims.manage`, permitindo acumular vendedor/SDR e sinistros no mesmo usuário.
- Menu do vendedor passou a mostrar Sinistros somente quando existe concessão.

### Arquivos principais

- `backend/migrations/versions/b4c91e8d2f60_add_claim_catalogs_and_workshops.py`
- `backend/app/modules/claims/models.py`
- `backend/app/modules/claims/routes.py`
- `backend/app/modules/claims/services.py`
- `frontend/src/features/sinistros/SinistrosPage.tsx`

### Testes executados

- `pytest -q` — 86 aprovados.
- `npm test -- --run` — 45 aprovados.
- Ruff, ESLint, typecheck e build — aprovados.
- Alembic — head único `b4c91e8d2f60`.
- PostgreSQL 16 — upgrade/downgrade/upgrade aprovado; semeadura validada com 3 ramos e
  14 seguradoras.
- `docker compose config --quiet` — aprovado; avisos esperados pela ausência do `.env`
  local.

### Resultado

- Implementação local aprovada na branch `feature/catalogos-oficinas-sinistros`.
- Publicado em produção em 2026-10-15 com o commit `96d6376`. O `scripts/deploy.sh` fez
  backup do banco, aplicou a migration `b4c91e8d2f60` e recriou `api`, `worker`,
  `scheduler` e `web`. O healthcheck passou e `flask db current` ficou em `b4c91e8d2f60`.
- Verificado em produção: três ramos cadastrados, Suhai disponível, nenhum sinistro sem
  ramo ou seguradora, `/api/v1/health` e SPA em 200, `/api/v1/claims` e
  `/api/v1/claims/catalogs` em 401 sem sessão.
- Observado: o catálogo de seguradoras é global e já tinha registros do módulo comercial,
  então a semeadura acrescentou os nomes novos e manteve os antigos em uso.

## 2026-10-16 - Designação da equipe de sinistros

### Realizado

- Identificada a causa raiz do relato "não tem aonde designar o sinistro": a lista fixa
  `KNOWN_PERMISSIONS` da tela de concessões omitia todas as permissões `claims.*`, de modo
  que somente o perfil `admin` conseguia operar o módulo.
- Optado por conceder acesso pelo sistema de `PermissionGrant` existente, em vez de criar um
  quarto perfil, mantendo a decisão reversível e auditável.
- Adicionado o campo **Acesso a sinistros** na criação e na edição de usuário, com os níveis
  Sem acesso, Consulta (`claims.read`) e Operação (`claims.manage`), além da coluna
  correspondente na listagem.
- Incluídas as permissões `claims.read`, `claims.manage` e `claims.view_financial` na tela
  de concessões e alinhada a rota do vendedor ao backend (`readOnly` derivado da concessão).

### Arquivos principais

- `backend/app/modules/admin/routes.py`
- `backend/tests/test_admin_claims_access.py`
- `frontend/src/features/admin/AdminUsuariosPage.tsx`
- `frontend/src/features/admin/AdminConcessoesPage.tsx`
- `frontend/src/app/App.tsx`

### Testes executados

- `pytest` — 85 aprovados; `ruff check` sem apontamentos.
- `npm test -- --run` — 44 aprovados; `typecheck`, `lint` e `build` aprovados.

### Publicado

- Commit `1b8d063` publicado em produção pelo `scripts/deploy.sh`.
- `GET https://funil.zhattiver.com/api/v1/health` — HTTP 200; SPA — HTTP 200;
  `GET /api/v1/admin/users` sem sessão — HTTP 401.

## 2026-10-16 - Módulo inicial de sinistros

### Realizado

- Implementado o domínio `claims` com autorização, auditoria, estados, atribuição,
  participantes, eventos, tarefas, arquivamento e metadados de documentos.
- Criadas telas administrativa, de consulta do vendedor e navegação condicional do SDR.
- Adicionados filtros, paginação e restrição do valor indenizado.

### Arquivos principais

- `backend/app/modules/claims/`
- `backend/migrations/versions/7d2f4c8a91be_add_claims_module.py`
- `frontend/src/features/sinistros/`
- `frontend/src/lib/api.ts`

### Testes executados

- `pytest` — 83 testes backend aprovados.
- `npm run test` — 42 testes frontend aprovados.
- Ruff, ESLint, typecheck e build — aprovados.
- `docker compose config` — aprovado com configuração local temporária.
- Migration PostgreSQL 16 — upgrade/downgrade/upgrade aprovado em stack isolada.

### Resultado

- Implementação local aprovada.
- Publicado em produção em 2026-10-15 com o commit `33ecab3`. O `scripts/deploy.sh` fez
  backup do banco, aplicou a migration `7d2f4c8a91be` e recriou `api`, `worker`,
  `scheduler` e `web`. O healthcheck passou e as seis tabelas de sinistros existem.
- Aprendizado: o acesso à VPS exige a chave dedicada `~/.ssh/funil_vps_ed25519` passada
  explicitamente com `-i`, pois não há `~/.ssh/config` apontando para ela.

## 2026-10-15 - Novo lead no funil e bônus por negócio

### Realizado

- Restaurado o botão `+` como ação `Novo lead` somente no layout do vendedor.
- Criado diálogo com nome, telefone, produto, cidade e UF.
- Criado endpoint transacional que persiste lead e oportunidade própria na etapa inicial.
- Corrigidos o cálculo de bônus fixo por negócio e os limites superiores das faixas.
- Ajustada a gestão administrativa para exibir valor por negócio e intervalos `[min, max)`.

### Arquivos principais

- `backend/app/modules/opportunities/routes.py`
- `backend/app/modules/opportunities/services.py`
- `backend/app/modules/bonus/services.py`
- `backend/app/modules/bonus/routes.py`
- `frontend/src/features/vendedor/NewLeadDialog.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/features/admin/AdminBonusPage.tsx`

### Testes executados

- `pytest` — 77 testes backend aprovados.
- `npm run test` — 40 testes frontend aprovados.
- Ruff, ESLint e typecheck — aprovados.
- Build do frontend e configuração dos Compose de produção/desenvolvimento — aprovados.

### Resultado

- Aprovado localmente.

## 2026-10-15 - Ampliação da logo nos cabeçalhos

### Realizado

- Ampliada a logo no cabeçalho compartilhado do vendedor e SDR.
- Ajustados os tamanhos da logo no cabeçalho mobile e no menu lateral do administrador.
- Mantidos o link para a página inicial e a exibição sem texto adicional.

### Arquivos principais

- `frontend/src/components/TopBar.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`

### Testes executados

- `npm run lint` — aprovado.
- `npm run typecheck` — aprovado.
- `npm run test -- --run src/components/TopBar.test.tsx` — 2 testes aprovados.
- `npm run build` — aprovado.

### Resultado

- Aprovado localmente.

## 2026-10-15 - Remoção do atalho de venda direta do vendedor

### Realizado

- Removido o botão `+` de venda direta do cabeçalho do vendedor.
- Removida a prop `addAction` do `TopBar`, que ficou sem consumidores após a mudança.
- `SaleFormDialog` preservado: o registro de venda continua acessível pelo drawer da
  oportunidade, no funil.
- Teste unitário do `TopBar` e teste E2E de navegação ajustados para a nova regra.

### Arquivos principais

- `frontend/src/features/vendedor/VendedorLayout.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/components/TopBar.test.tsx`
- `frontend/e2e/responsive-navigation.spec.ts`

### Testes executados

- `npm run test -- --run` — 38 testes aprovados em 16 arquivos.
- `npm run lint` — aprovado.
- `npm run typecheck` — aprovado.
- `npm run build` — aprovado.

### Resultado

- Aprovado localmente.

## 2026-10-15 - Cabeçalho somente com a logo

### Realizado

- Removido o texto `Lynk` abaixo da logo no cabeçalho compartilhado de vendedor e SDR.
- Aplicado o mesmo ajuste no cabeçalho mobile e no menu lateral do administrador.
- Mantido o link da logo para a página inicial correspondente ao perfil.

### Arquivos principais

- `frontend/src/components/TopBar.tsx`
- `frontend/src/components/TopBar.test.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`

### Testes executados

- `npm run test -- --run src/components/TopBar.test.tsx` — 2 testes aprovados.
- `npm run lint` — aprovado.
- `npm run typecheck` — aprovado.
- `npm run build` — aprovado.

### Resultado

- Aprovado localmente.

## 2026-10-15 - Telas do vendedor alinhadas às referências visuais

### Realizado

- Analisadas as quatro capturas enviadas pela operação (Dashboard, Prospecção,
  Agendamentos e Funil) e registrado o padrão visual identificado no Vault.
- Criado o kit compartilhado `VendedorUi` com badges, barras de meta, medidor semicircular,
  cartões de métrica, contagem de dias e cabeçalhos de tabela.
- Dashboard reorganizada em duas colunas: agendamentos e follow-ups à esquerda; metas do
  dia, meta do mês e desempenho à direita.
- Prospecção ganhou banner com meta do dia e filtros de busca, cidade e origem.
- Agendamentos ganhou cinco métricas, lista agrupada por dia e calendário mensal lateral
  com contador e seleção de dia.
- Funil ganhou banner de metas e cartões com origem e tempo desde a última ação.
- Mantida a restrição de não oferecer cadastro de metas, faixas de bônus ou comissões ao
  vendedor.

### Arquivos principais

- `frontend/src/components/VendedorUi.tsx`
- `frontend/src/components/VendedorUi.test.tsx`
- `frontend/src/features/vendedor/VendedorDashboard.tsx`
- `frontend/src/features/vendedor/ProspeccaoPage.tsx`
- `frontend/src/features/vendedor/AgendamentosPage.tsx`
- `frontend/src/features/vendedor/FunilPage.tsx`
- `docs/obsidian/03 - Funcionalidades/Telas do Vendedor.md`

### Testes executados

- `npm run lint` — aprovado.
- `npm run typecheck` — aprovado.
- `npm run test -- --run` — 38 testes aprovados em 16 arquivos.
- `npm run build` — aprovado, maior chunk em 188 kB.

### Resultado

- Aprovado localmente.

### Próximos passos

- Publicar em produção e validar as telas com a operação.

## 2026-10-15 - Ajuste da marca no cabeçalho

### Realizado

- Removido o rótulo de perfil exibido junto à marca no menu administrativo.
- Logo e nome `Lynk` foram reorganizados verticalmente, com o nome em tamanho pequeno.
- A marca dos cabeçalhos agora é clicável e direciona para a dashboard inicial conforme
  o perfil autenticado.
- Adicionado teste do link para a dashboard no componente compartilhado `TopBar`.

### Arquivos principais

- `frontend/src/components/TopBar.tsx`
- `frontend/src/components/TopBar.test.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`
- `docs/obsidian/03 - Funcionalidades/Qualidade da Interface.md`

### Testes executados

- `npm run test -- --run src/components/TopBar.test.tsx` — 2 testes aprovados.
- `npm run lint` — aprovado.
- `npm run typecheck` — aprovado.
- `npm run build` — aprovado.

### Resultado

- Aprovado localmente. Pendente de publicação.

## 2026-10-15 - Correção das barreiras de qualidade e publicação

### Realizado

- Corrigido o passivo de lint Ruff no backend e incluído `ruff check` na validação local
  e na CI.
- ESLint passou a ser executado também na CI e pelo verificador local.
- O build Vite passou a separar React, consultas, formulários e ícones em chunks próprios,
  eliminando o alerta de chunk principal acima de 500 kB.
- Removida a desativação global de redirecionamentos HTTP do Caddy.
- Sincronizadas as contagens de testes e as pendências operacionais no Vault.

### Testes executados

- `scripts/verify.ps1` — aprovado.
- Backend: 73 testes, Ruff aprovado.
- Frontend: ESLint, typecheck, 32 testes e build aprovados.
- Compose de produção e desenvolvimento — aprovado.

### Resultado

- Commit `6929999` integrado à `main`, enviado ao GitHub e publicado na VPS.
- Backup pré-deploy criado e migração confirmada na head `6c9e0b4d7a12`.
- Serviços `api`, `worker`, `scheduler` e `web` recriados; API e worker saudáveis.
- Healthcheck público respondeu `200` e o acesso HTTP passou a redirecionar para HTTPS
  com resposta `308`.
- Bundle publicado confirmado pelo chunk principal `index-BQEQR4aI.js`.

## 2026-10-14 - Importação de planilhas para o administrador

### Realizado

- Verificado que `POST /api/v1/imports` já autoriza administrador e SDR, mas a
  área `/admin/*` não tinha rota nem tela de importação.
- Tela movida de `features/sdr/SdrImportacoesPage.tsx` para
  `features/imports/ImportacoesPage.tsx`, compartilhada pelos dois perfis.
- Criada a rota `/admin/importacoes`, o item de menu no grupo Comercial e o
  atalho no painel administrativo.
- Nenhuma alteração no backend foi necessária.

### Arquivos principais

- frontend/src/features/imports/ImportacoesPage.tsx
- frontend/src/features/imports/ImportacoesPage.test.tsx
- frontend/src/app/App.tsx
- frontend/src/features/admin/AdminLayout.tsx
- frontend/src/features/admin/AdminDashboard.tsx
- docs/obsidian/03 - Funcionalidades/Importação de Planilhas.md

### Testes executados

- `npm run test` — 32 testes aprovados em 15 arquivos.
- `npm run typecheck` — aprovado.
- `npm run lint` — aprovado.
- `npm run build` — aprovado.

### Resultado

- Aprovado. Pendente de push e deploy, que dependem de autorização do responsável.

### Próximos passos

- Publicar em produção e validar o upload de uma planilha real pelo administrador.

## 2026-10-14 - Deploy dos dashboards por perfil

### Realizado

- Executado o deploy oficial do commit `7b09052` na VPS Hostinger.
- Recriados os serviços web, API, worker e scheduler com as imagens atualizadas.
- Confirmada a migração `6c9e0b4d7a12` como head.
- Validado o healthcheck interno e o endpoint público de produção.

### Testes executados

- `npm run test` — 30 testes aprovados em 14 arquivos.
- `npm run typecheck` — aprovado.
- `npm run lint` — aprovado.
- `npm run build` — aprovado.
- `GET https://funil.zhattiver.com/api/v1/health` — HTTP 200.

### Resultado

- Deploy aprovado e produção saudável.

## 2026-10-14 - UI dos dashboards por perfil

### Realizado

- Analisadas quatro referências visuais do vendedor: dashboard, prospecção,
  agendamentos e funil.
- Aplicado o padrão escuro com bordas ciano, cartões, métricas, chips e ações
  destacadas aos dashboards de vendedor, SDR e administrador.
- Preservadas as rotas, consultas e autorizações existentes para evitar conflitos
  entre perfis.
- Removidos do rascunho indicadores, clientes, telefones, datas e metas fictícios.
- Controles sem ação foram substituídos por links para fluxos já implementados.
- Criados componentes compartilhados para métricas, atalhos e estados de painel.
- Adicionados estados explícitos de carregamento, vazio e erro.

### Arquivos principais

- `frontend/src/components/DashboardUi.tsx`
- `frontend/src/features/vendedor/VendedorDashboard.tsx`
- `frontend/src/features/sdr/SdrDashboard.tsx`
- `frontend/src/features/admin/AdminDashboard.tsx`
- `docs/obsidian/03 - Funcionalidades/Painéis por Perfil.md`

### Testes executados

- Testes de componente dos três dashboards.
- `npm run typecheck`
- `npm run lint`
- `npm run build`

### Resultado

- Aprovado. Os painéis exibem somente dados reais das APIs ou estados explícitos
  de indisponibilidade.

### Próximos passos

- Revisão visual em ambiente autenticado antes de um futuro deploy.

## 2026-10-14 - Refinamento do login, favicon e marca Lynk

### Realizado

- Refinado o cartão de login conforme os cinco pontos pedidos: fundo `#071521`
  com borda sutil e raio de 20px, largura máxima de 380px, padding interno de
  32px, espaçamentos padronizados, campos escuros de 48px com toggle de senha,
  e botão ciano de 46px com hover.
- Adicionados estados de carregamento, envio por Enter, navegação por teclado,
  `aria-invalid`/`aria-describedby` e mensagens de erro específicas para 401,
  429 e 403.
- Favicon gerado a partir do símbolo do logotipo oficial, reaproveitando o path
  e o gradiente do SVG com os tons claros para legibilidade em 16px.
- Marca visível renomeada de "Funil Sustentare" para **Lynk**, conforme
  confirmação do responsável pelo projeto. Registrada a ADR-002, que substitui
  a ADR-001. Entradas históricas do Changelog e deste diário foram preservadas.
- Corrigido o cenário Playwright de login, que ainda referenciava o título
  antigo, os rótulos "Email"/"Entrar" e a recuperação de senha removida.

### Arquivos principais

- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/LoginPage.test.tsx`
- `frontend/e2e/login.spec.ts`
- `frontend/public/favicon.svg`
- `frontend/index.html`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`
- `backend/app/cli/__init__.py`
- `backend/app/modules/auth/password_recovery.py`
- `docs/obsidian/06 - Decisões Técnicas/ADR-002 - Marca oficial Lynk.md`

### Testes executados

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

### Resultado

- Aprovado.

### Próximos passos

- Deploy na VPS e verificação da aba do navegador em produção.

## 2026-10-14 - Ajuste visual da tela de login

### Realizado

- Aplicada a referência visual enviada: fundo em gradiente, cartão escuro central,
  campos arredondados, botão ciano e logo no topo.
- Removidos os seletores de vendedor e SDR da tela; o redirecionamento permanece
  automático conforme o papel devolvido pela autenticação.
- Removidos o link e as rotas públicas de recuperação de senha por enquanto.
- Incorporado o SVG fornecido como logo padrão do login e das áreas autenticadas.

### Arquivos principais

- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/components/TopBar.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`
- `frontend/public/logo-lynk.svg`

### Testes executados

- Teste unitário da tela de login cobrindo ausência de seletor de perfil e recuperação.
- Teste de build e typecheck do frontend.

### Resultado

- Aprovado e publicado em produção no commit `8c2798e`.
- Healthcheck externo respondeu `200` e a página pública confirmou logo, campos Login/Senha
  e botão ACESSAR, sem recuperação de senha ou seletores de vendedor/SDR.

### Próximos passos

- Aplicar as próximas referências visuais após aprovação desta tela.

## 2026-10-14 - Adiamento do SMTP e preparo para referências de UI/UX

### Realizado

- Registro da decisão da operação de entrar em produção sem recuperação de senha por
  e-mail. A redefinição administrativa em Equipe > Editar passa a ser o caminho oficial
  para esquecimento de senha, e o SMTP sai da lista de pendências ativas.
- Reescrita de `docs/referencias/README.md` como guia de envio de prints de UI/UX, com
  convenção de nomes por tela e formato, informações exigidas por print e as regras de
  uso (somente aparência, identidade Funil Sustentare, requisito escrito prevalece).
- Exclusão do conteúdo de `docs/referencias/` do versionamento, preservando o README,
  já que prints podem conter dados reais de clientes.

### Arquivos principais

- `.gitignore`
- `docs/referencias/README.md`
- `docs/obsidian/11 - Pendências/Backlog.md`
- `docs/obsidian/11 - Pendências/Problemas Conhecidos.md`
- `PROGRESS.md`

### Testes executados

- `git check-ignore -v docs/referencias/README.md` para confirmar que o guia continua
  versionado enquanto os prints são ignorados.

### Resultado

- Aprovado. Alteração exclusivamente documental e de versionamento, sem impacto em código.

### Próximos passos

- Receber os prints de UI/UX e aplicar o Protocolo de Análise de Referências.

## 2026-10-14 - Fechamento funcional sem dependência de SDR

### Realizado

- Confirmação de que `179.197.72.43` é a VPS Hostinger correta.
- Retirada do usuário SDR do escopo imediato de entrada em operação.
- Reaproveitamento do fluxo completo de prospecção para o administrador cadastrar,
  disponibilizar e arquivar leads.
- Gestão da meta diária de prospecção na tela Equipe, com vigência, histórico e auditoria.
- Conferência da configuração de produção: produto, funil, seis etapas, origens, tipos de
  cliente, seguradoras, motivos de perda e tipos de próxima ação estão semeados.

### Arquivos principais

- `backend/app/modules/admin/routes.py`
- `frontend/src/features/admin/AdminLeadsPage.tsx`
- `frontend/src/features/admin/AdminUsuariosPage.tsx`
- `docs/obsidian/03 - Funcionalidades/Prospecção Administrativa.md`

### Testes executados

- `scripts/verify.ps1`: 73 testes backend, 17 frontend, typecheck, build e Compose.

### Resultado

- Commit `e23d4ae` publicado na VPS Hostinger.
- Prospecção administrativa e meta diária validadas no domínio público com contas
  descartáveis. Após a limpeza, a base voltou a dois usuários e zero quotas.
- Permanecem apenas valores comerciais a definir e a credencial externa da caixa de e-mail.

### Próximos passos

- Definir a meta diária da vendedora e, antes da apuração, metas mensais/faixas de bônus.

## 2026-10-14 - Validação da redefinição administrativa de senha

### Realizado

- Criação de um par descartável de administrador e vendedor diretamente no banco de
  produção, com senhas aleatórias e auditoria explícita.
- Autenticação do administrador pelo domínio público, com cookie CSRF e cabeçalho
  `X-CSRF-Token`.
- Chamada de `PATCH /api/v1/admin/users/<id>` com `reset_password`, respondendo `200`.
- Login do vendedor com a nova senha, abertura de sessão própria e confirmação de `403`
  ao tentar uma rota administrativa.
- Conferência da trilha de auditoria: dois cadastros, uma atualização e dois logins.
- Remoção das contas descartáveis e dos scripts temporários do servidor e do contêiner.

### Arquivos principais

- PROGRESS.md
- docs/checklist-producao.md
- docs/obsidian/11 - Pendências/Problemas Conhecidos.md

### Testes executados

- Fluxo HTTPS real contra `funil.zhattiver.com`: login do administrador, redefinição,
  login do vendedor, sessão autenticada e bloqueio por papel.
- Verificação pós-limpeza: login das contas removidas responde `401`, base volta a
  administrador e vendedor, `GET /api/v1/health` responde `200` e os seis serviços
  seguem saudáveis.

### Resultado

- Aprovado. A ausência de SMTP deixa de ser bloqueador para a entrada em operação.

### Próximos passos

- Cadastrar metas mensais e faixas de bônus.
- Criar o usuário SDR.
- Homologar os fluxos comerciais das RN marcadas com `🟨`.

## 2026-10-14 - Deploy de produção e execução do checklist

### Realizado

- Identificação do endereço ativo da VPS Hostinger, diferente do informado inicialmente.
- Backup do banco e do `.env` antes de qualquer alteração, com integridade verificada.
- Atualização do código de `bfcfac7` para `c7733f3` por fast-forward de 32 commits.
- Complemento do `.env` com as variáveis de URL pública, rate limiting e recuperação de senha.
- Build das imagens, aplicação de três migrações até a head `6c9e0b4d7a12` e recriação dos serviços.
- Execução completa de `docs/checklist-producao.md`.
- Teste de restauração do backup em banco separado, descartado após a conferência.
- Execução manual do job de follow-ups e conferência do agendador.
- Smoke test autenticado com administrador descartável em painel, equipe, metas e bônus,
  configurações e auditoria.
- Remoção da conta descartável e confirmação de que a sessão perdeu o acesso.

### Arquivos principais

- `scripts/deploy.sh`
- `scripts/healthcheck.sh`
- `docs/checklist-producao.md`

### Testes executados

- `scripts/healthcheck.sh` no servidor.
- Verificação HTTPS de saúde, sessão ausente, rota inexistente e mutação por GET.
- Teste real de rate limiting no login.
- Login real, carregamento dos módulos administrativos e revogação do acesso após limpeza.
- Restauração do dump em banco temporário e conferência das tabelas e registros.
- Inspeção de portas expostas, cabeçalhos de segurança e validade do certificado.

### Resultado

- Deploy aprovado. Domínio público passou a servir o Funil Sustentare.
- Checklist técnico e smoke test autenticado aprovados.

### Próximos passos

- Criar senha exclusiva da caixa Locaweb e executar `/root/configure-smtp.py`; endpoint,
  STARTTLS e conectividade já foram validados.
- Cadastrar metas mensais e faixas de bônus.
- Homologar os fluxos comerciais no domínio público.

## 2026-10-13 - Gestão administrativa de metas e bônus

### Realizado

- Tela administrativa dividida em apuração, metas mensais e faixas versionadas.
- Validação multiempresa de vendedores e produtos.
- Bloqueio de faixas temporais/métricas sobrepostas e alterações retroativas.
- Encerramento de vigência e cancelamento de bônus com auditoria.
- Índices únicos parciais para metas gerais e por produto.

### Arquivos principais

- `backend/app/modules/bonus/routes.py`
- `backend/app/modules/bonus/services.py`
- `backend/migrations/versions/6c9e0b4d7a12_enforce_monthly_goal_uniqueness.py`
- `frontend/src/features/admin/AdminBonusPage.tsx`

### Testes executados

- 71 testes pytest.
- 15 testes Vitest.
- Ruff direcionado, TypeScript, ESLint e build Vite.

### Resultado

- RN-043..RN-051 verificadas localmente.

### Próximos passos

- Publicar a migration e a interface na VPS.
- Repetir a homologação no domínio público.

## 2026-10-14 - Auditoria de navegação e acabamento visual

### Realizado

- Auditoria visual local dos perfis administrador, vendedor e SDR em desktop e celular.
- Menu administrativo responsivo e navegação horizontal contida nos demais perfis.
- Remoção de busca e botões sem comportamento disponível.
- Correção de títulos com contraste inválido por colisão de classes Tailwind.
- Cards com destino real, textos operacionais revisados e métricas fictícias removidas.
- Logout protegido contra restauração de resposta autenticada pelo cache do navegador.
- Registro de que o domínio público ainda executa uma versão antiga.

### Arquivos principais

- `frontend/src/components/TopBar.tsx`
- `frontend/src/features/admin/AdminLayout.tsx`
- `frontend/src/styles/globals.css`
- `frontend/e2e/responsive-navigation.spec.ts`

### Testes executados

- TypeScript e ESLint.
- 12 testes Vitest.
- Build Vite de produção.
- Playwright com 14 de 14 cenários aprovados em base limpa.
- Verificação manual das 23 rotas autenticadas em viewport de 390 px.

### Resultado

- Navegação e acabamento visual aprovados localmente.

### Próximos passos

- Publicar a `main` atualizada na VPS.
- Repetir a auditoria no domínio público após o deploy.

## 2026-10-14 - Recuperação segura de senha

### Realizado

- Solicitação pública com resposta não enumerável.
- Token expirável de uso único persistido somente como hash.
- Envio SMTP com URL pública configurada e intervalo anti-spam.
- Redefinição com Argon2id e invalidação de todas as sessões.
- Telas públicas integradas ao login do Funil Sustentare.

### Testes executados

- Ruff nos arquivos backend alterados e 67 testes pytest.
- Typecheck, ESLint, 10 testes Vitest e build Vite.
- Playwright com 11 de 11 cenários aprovados em base limpa.
- Grafo Alembic com head único `4b7ac198d21e`.

### Resultado

- Recuperação de senha aprovada localmente.

### Próximos passos

- Configurar e validar o SMTP no domínio de homologação.
- Homologar deploy e restauração de backup na VPS.

## 2026-10-13 - Catálogos administrativos

### Realizado

- Gestão de produtos, origens, tipos de cliente e seguradoras.
- Gestão de categorias de tag, tags e cores.
- Edição, arquivamento e restauração sem exclusão de histórico.
- Auditoria e validação multiempresa em todas as mutações.

### Testes executados

- Ruff e 61 testes backend.
- Typecheck, ESLint, 8 testes Vitest e build frontend.
- Playwright com 10 de 10 cenários aprovados em base limpa.

### Resultado

- Catálogos administrativos aprovados.

### Versionamento

- PR #6: manutenção completa dos catálogos administrativos.

### Próximos passos

- Recuperação segura de senha.
- Homologação e restauração de backup na VPS.

## 2026-10-13 - Relatórios administrativos e RN-072

### Realizado

- API mensal de produção com filtros por vendedor e produto.
- Tela administrativa com totais, estados e agrupamento financeiro.
- Restrição exclusiva para administradores e isolamento por organização.
- Validação do tenant de vendedor, seguradora e tipo de cliente no registro de venda.
- Extensão do fluxo E2E após a validação da venda.

### Testes executados

- Ruff, pytest direcionado e suíte backend completa.
- Typecheck, ESLint, Vitest e build frontend.
- Playwright com 9 de 9 cenários aprovados localmente.

### Resultado

- Relatório aprovado e RN-072 verificada.

### Versionamento

- PR #5: relatórios administrativos seguros.

### Próximos passos

- Recuperação segura de senha.
- Homologação e restauração de backup na VPS.

## 2026-10-13 - Verificação da RN-038

### Realizado

- Centralização do filtro de vendas elegíveis para produção, metas e bônus.
- Cobertura de vendas registradas, validadas, em revisão e canceladas.
- Verificação de isolamento por organização, vendedor, produto e competência.

### Testes executados

- `python -m pytest tests/test_sales.py -q`.
- `python -m ruff check app/modules/bonus/services.py app/modules/bonus/routes.py tests/test_sales.py`.

### Resultado

- RN-038 aprovada nos testes direcionados.

### Versionamento

- PR #4: verificação da elegibilidade de vendas validadas.

### Próximos passos

- Configurações administrativas restantes.
- Homologação e restauração de backup na VPS.

## 2026-10-13 - Identidade Funil Sustentare

### Realizado

- Atualização do nome visível, título do navegador e favicon.
- Preservação de identificadores técnicos por compatibilidade.
- Cobertura Playwright da identidade oficial.
- Criação da estrutura inicial do Vault.

### Testes executados

- Typecheck, ESLint, Vitest e build frontend.
- Pytest e Ruff nos arquivos backend afetados.
- Playwright com 9 de 9 cenários aprovados localmente.

### Versionamento

- PR #3: identidade Funil Sustentare e criação do Vault.

### Próximos passos

- Homologação na VPS.
- Backup e restauração.
- Relatórios financeiros.
