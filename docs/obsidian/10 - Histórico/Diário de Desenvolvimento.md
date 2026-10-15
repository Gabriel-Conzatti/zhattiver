# Diário de Desenvolvimento

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

- Aprovado localmente e pronto para publicação Git.

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
