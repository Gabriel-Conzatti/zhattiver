# Changelog

## [2026-10-15] - Cabeçalho somente com a logo

### Alterado

- Removido o texto `Lynk` abaixo da logo nos cabeçalhos autenticados.
- A logo continua clicável e retorna à página inicial do perfil atual.

## [2026-10-15] - Telas do vendedor alinhadas às referências

### Adicionado

- Kit visual compartilhado do vendedor com badges de origem, barras de meta, medidor
  semicircular de meta mensal, cartões de métrica e cabeçalhos de tabela padronizados.
- Filtros com efeito real em Prospecção (busca, cidade, origem) e em Agendamentos
  (busca, origem e seleção de dia pelo calendário).
- Calendário mensal lateral em Agendamentos, com contador de agendamentos por dia.

### Alterado

- Dashboard do vendedor reorganizada em agendamentos, follow-ups, metas do dia, meta do
  mês e resumo de desempenho.
- Funil passou a exibir banner de metas e cartões com origem e tempo desde a última ação.
- Agendamentos passou a listar os registros agrupados por dia, com cinco métricas no topo.

### Segurança

- As telas do vendedor continuam sem qualquer ação de cadastro de metas, faixas de bônus
  ou comissões; essas operações permanecem exclusivas do administrador.

## [2026-10-15] - Navegação pela marca

### Alterado

- A logo dos cabeçalhos autenticados passou a exibir somente o nome `Lynk` pequeno
  abaixo do símbolo.
- Clicar na marca retorna à dashboard inicial do perfil atual.
- O menu administrativo aplica o mesmo padrão em desktop e mobile.

## [2026-10-15] - Qualidade e importação administrativa publicadas

Commit `6929999` publicado em `funil.zhattiver.com`.

### Adicionado

- Importação de planilhas disponível para o administrador em `/admin/importacoes`.
- Ruff e ESLint incluídos nas barreiras locais e da CI.

### Alterado

- Bundle frontend dividido em chunks menores para remover o alerta de arquivo acima de
  500 kB.
- Caddy voltou a redirecionar automaticamente HTTP para HTTPS.

### Operação

- Backup pré-deploy concluído.
- Migração confirmada na head `6c9e0b4d7a12`.
- Serviços recriados e healthcheck público aprovado.

## [2026-10-14] - Dashboards publicados em produção

Commit `7b09052` publicado em `funil.zhattiver.com`.

### Operação

- Build Docker concluído sem erros.
- Serviços API, web, worker, scheduler, PostgreSQL e Redis saudáveis.
- Migração confirmada na head `6c9e0b4d7a12`.
- Healthcheck público `/api/v1/health` retornando HTTP 200.

## [2026-10-14] - Publicado em produção

Commit `c7733f3` publicado em `funil.zhattiver.com`, substituindo a versão de 01/10/2026.
Todo o conteúdo listado em "Não publicado" até esta data passou a valer em produção.

### Operação

- Três migrações aplicadas até a head `6c9e0b4d7a12`.
- Fechamento funcional sem dependência de SDR publicado no commit `e23d4ae`.
- Nova tela de login e logo oficial publicados no commit `8c2798e`.
- A migração de invalidação de sessões exige novo login de todos os usuários.
- Variáveis de URL pública, rate limiting e recuperação de senha explicitadas no `.env`.
- Backup pré-deploy verificado e restauração validada em banco separado.

## [Não publicado]

### Alterado

- Tela de Importações movida para o módulo compartilhado
  `frontend/src/features/imports/ImportacoesPage.tsx`, usada pelas rotas de
  administrador e de SDR sem duplicar código.
- Dashboards de vendedor, SDR e administrador alinhados ao padrão visual escuro
  das referências, com cartões, indicadores e atalhos responsivos.
- Painéis passam a exibir estados explícitos de carregamento, vazio e erro, sem
  substituir falhas de API por métricas ou clientes fictícios.
- Marca oficial do produto alterada para **Lynk** no título do navegador,
  descrição, login, cabeçalho de vendedor/SDR e navegação administrativa
  (ADR-002, substitui a ADR-001).
- Favicon gerado a partir do símbolo do logotipo oficial, substituindo o ícone
  provisório com a letra "F".
- Cartão de login refinado: fundo `#071521`, borda sutil, raio de 20px,
  largura máxima de 380px e padding interno de 32px.
- Campos de login escuros com 48px de altura, destaque ciano no foco e botão
  para mostrar/ocultar a senha.
- Botão de acesso com 46px de altura, cantos menos arredondados e hover sutil.

### Adicionado

- Estados de carregamento, envio por Enter, mensagens de erro específicas por
  situação (credenciais, excesso de tentativas, acesso bloqueado) e suporte a
  leitores de tela na tela de login.
- Logo SVG oficial aplicada ao login e às áreas autenticadas.

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

- Tela de login alinhada à referência visual enviada, com entrada única e
  redirecionamento automático conforme o papel autenticado.
- Recuperação de senha removida da navegação pública temporariamente.
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
