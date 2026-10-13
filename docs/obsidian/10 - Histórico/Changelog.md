# Changelog

## [Não publicado]

### Adicionado

- Seed E2E isolado e reproduzível.
- Validação administrativa de venda por Playwright.
- Vault de documentação do projeto.
- Relatório mensal de produção por vendedor e produto.

### Alterado

- Identidade visível atualizada para Funil Sustentare.
- Elegibilidade de vendas para produção, metas e bônus centralizada conforme RN-038.

### Corrigido

- Corridas e duplicações no primeiro contato.
- Barreiras de autorização e isolamento multiempresa.
- Estados pendentes, em revisão e cancelados impedidos de compor a apuração comercial.
- Referências financeiras externas à organização rejeitadas ao registrar vendas.

### Segurança

- Rate limiting distribuído no login.
- Invalidação de sessões após troca ou reset de senha.
- Relatórios financeiros restritos a administradores e isolados por organização.
