# Changelog

## [Não publicado]

### Adicionado

- Seed E2E isolado e reproduzível.
- Validação administrativa de venda por Playwright.
- Vault de documentação do projeto.
- Relatório mensal de produção por vendedor e produto.
- Manutenção administrativa de produtos, origens, tipos de cliente, seguradoras e tags.
- Recuperação de senha por email com token expirável de uso único.
- Gestão administrativa de metas mensais e faixas de bônus versionadas.
- Cancelamento auditado de bônus ainda não pagos.

### Alterado

- Identidade visível atualizada para Funil Sustentare.
- Elegibilidade de vendas para produção, metas e bônus centralizada conforme RN-038.
- Apuração de bônus agora exibe nomes de vendedores e produtos em vez de identificadores.

### Corrigido

- Ícones e controles de cabeçalho sem ação para determinados perfis.
- Estouro horizontal e navegação cortada em telas móveis.
- Títulos quase invisíveis causados por colisão entre token de cor e classe tipográfica.
- Reaparecimento visual de sessão após logout por cache HTTP do navegador.
- Textos técnicos e métricas fictícias expostos na interface.
- Corridas e duplicações no primeiro contato.
- Barreiras de autorização e isolamento multiempresa.
- Estados pendentes, em revisão e cancelados impedidos de compor a apuração comercial.
- Referências financeiras externas à organização rejeitadas ao registrar vendas.
- Categoria externa rejeitada ao criar ou editar tags.
- Referências externas e faixas sobrepostas rejeitadas ao configurar metas e bônus.
- Duplicidade de meta geral impedida por índice único parcial.

### Segurança

- Rate limiting distribuído no login.
- Invalidação de sessões após troca ou reset de senha.
- Relatórios financeiros restritos a administradores e isolados por organização.
- Tokens de recuperação persistidos somente como hash e sessões invalidadas após uso.
