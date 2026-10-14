# Painéis por Perfil

## Objetivo

Aplicar aos painéis de vendedor, SDR e administrador o padrão visual escuro das
referências enviadas, preservando os fluxos, contratos de API e limites de
autorização existentes.

## Referências analisadas

Foram analisadas quatro telas do perfil vendedor:

- dashboard com agendamentos, metas diárias, meta mensal e follow-ups;
- prospecção com indicadores e filtros;
- agenda com indicadores e calendário;
- funil em colunas.

O padrão identificado usa fundo azul quase preto, bordas ciano discretas,
cartões com hierarquia clara, indicadores numéricos, chips de estado, botões
laranja para ações primárias e ciano para navegação e progresso.

## Decisões de adaptação

- O dashboard do vendedor usa somente agendamentos, metas, produção e
  follow-ups retornados pelas APIs já existentes.
- O dashboard do SDR reutiliza o mesmo sistema visual, mas mostra apenas dados
  permitidos ao perfil: total de leads, importações, duplicidades do último lote
  e detalhes reais da última importação.
- O dashboard administrativo reutiliza os cartões e painéis do vendedor, com
  indicadores consolidados e atalhos para os módulos administrativos.
- A navegação lateral administrativa foi preservada porque acomoda mais módulos
  e evita conflito estrutural com rotas e permissões existentes.
- Elementos presentes apenas nos prints, sem API ou ação implementada, não são
  simulados. As telas mostram estados explícitos de carregamento, vazio e erro.
- Nomes, telefones, datas, metas e quantidades das referências não são
  incorporados ao sistema.

## Perfis autorizados

- Vendedor: dados próprios, conforme as rotas `/me/*` e `scope=mine`.
- SDR: leads, importações e agendamentos permitidos ao perfil.
- Administrador: indicadores consolidados e módulos administrativos.

## Segurança

- Nenhuma regra de autorização foi movida para o frontend.
- O redesenho não amplia rotas nem permissões.
- Dados financeiros do vendedor continuam condicionados à resposta autorizada
  do backend.
- Nenhum dado fictício é usado como fallback quando uma API falha.

## Estados de interface

- Carregando: valor neutro ou mensagem de carregamento.
- Vazio: mensagem específica sem criar registros de exemplo.
- Erro: alerta com ação para tentar novamente.
- Sucesso: apenas dados retornados pela API.

## Testes

- Testes de componente para os três dashboards.
- Cobertura de respostas reais, ausência de placeholders e falhas de API.
- Typecheck, ESLint e build de produção.

## Histórico

- 2026-10-14 - Padrão visual das referências aplicado aos três perfis.
