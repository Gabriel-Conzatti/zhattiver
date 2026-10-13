# Diário de Desenvolvimento

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
