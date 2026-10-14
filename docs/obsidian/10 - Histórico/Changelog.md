# Changelog

## [2026-10-14] - Publicado em produção

Commit `c7733f3` publicado em `funil.zhattiver.com`, substituindo a versão de 01/10/2026.
Todo o conteúdo listado em "Não publicado" até esta data passou a valer em produção.

### Operação

- Três migrações aplicadas até a head `6c9e0b4d7a12`.
- A migração de invalidação de sessões exige novo login de todos os usuários.
- Variáveis de URL pública, rate limiting e recuperação de senha explicitadas no `.env`.
- Backup pré-deploy verificado e restauração validada em banco separado.

## [Não publicado]

### Adicionado

- Cadastro e disponibilização de leads na tela administrativa de Prospecção.
- Configuração versionada da meta diária do vendedor pela tela Equipe.
- Seed E2E isolado e reproduzível.
- Validação administrativa de venda por Playwright.
- Vault de documentação do projeto.
- Relatório mensal de produção por vendedor e produto.
- Manutenção administrativa de produtos, origens, tipos de cliente, seguradoras e tags.
- Recuperação de senha por email com token expirável de uso único.
- Gestão administrativa de metas mensais e faixas de bônus versionadas.
- Cancelamento auditado de bônus ainda não pagos.

### Alterado

- Usuário SDR deixa de ser requisito para iniciar a operação.
- Documentação identifica `179.197.72.43` como a VPS Hostinger de produção.
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
