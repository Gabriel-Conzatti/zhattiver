# Diário de Desenvolvimento

## 2026-10-14 - Deploy de produção e execução do checklist

### Realizado

- Identificação do host real de produção, diferente do documentado no Vault.
- Backup do banco e do `.env` antes de qualquer alteração, com integridade verificada.
- Atualização do código de `bfcfac7` para `c7733f3` por fast-forward de 32 commits.
- Complemento do `.env` com as variáveis de URL pública, rate limiting e recuperação de senha.
- Build das imagens, aplicação de três migrações até a head `6c9e0b4d7a12` e recriação dos serviços.
- Execução completa de `docs/checklist-producao.md`.
- Teste de restauração do backup em banco separado, descartado após a conferência.
- Execução manual do job de follow-ups e conferência do agendador.

### Arquivos principais

- `scripts/deploy.sh`
- `scripts/healthcheck.sh`
- `docs/checklist-producao.md`

### Testes executados

- `scripts/healthcheck.sh` no servidor.
- Verificação HTTPS de saúde, sessão ausente, rota inexistente e mutação por GET.
- Teste real de rate limiting no login.
- Restauração do dump em banco temporário e conferência das tabelas e registros.
- Inspeção de portas expostas, cabeçalhos de segurança e validade do certificado.

### Resultado

- Deploy aprovado. Domínio público passou a servir o Funil Sustentare.
- Pendente apenas a validação do login autenticado pelo titular da credencial.

### Próximos passos

- Configurar SMTP real e validar a recuperação de senha.
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
