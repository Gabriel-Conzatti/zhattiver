# Telas do Vendedor

## Objetivo

Padronizar as quatro telas operacionais do vendedor (Dashboard, Prospecção, Agendamentos
e Funil) seguindo as referências visuais enviadas pela operação, preservando as regras de
autorização e sem exibir dados que o backend não fornece.

## Regras de negócio

- O vendedor apenas **visualiza** as próprias metas. Cadastro e edição de metas, faixas de
  bônus e comissões permanecem exclusivos do administrador (MP-003, MP-004, RN-072).
- Nenhum dado de outro vendedor aparece nas telas, em nenhum caminho.
- A meta operacional do dia fecha às 19h e é exibida com o horário retornado por
  `GET /me/goals/today`.
- A janela ideal de agendamento permanece de 5 a 7 dias úteis antes da vigência (RN-009) e o
  limite de abordagem segue a RN-011.

## Perfis autorizados

- Vendedor (acesso completo às quatro telas).
- Administrador (visualiza as mesmas telas apenas quando autenticado como vendedor).

## Fluxo principal

1. O vendedor abre a Dashboard e vê agendamentos próximos, follow-ups ociosos, metas do dia,
   meta do mês e o resumo do próprio desempenho.
2. Em Prospecção, filtra os leads disponíveis e dispara a mensagem inicial.
3. Em Agendamentos, acompanha as métricas, navega pelo calendário mensal e contata ou resolve.
4. No Funil, abre o card da oportunidade para registrar contato, mudar etapa ou fechar.
5. Pelo botão `Novo lead` no cabeçalho, cadastra nome, telefone, produto e localização; o
   lead entra diretamente na etapa inicial do funil do produto.

## Referências analisadas

Foram analisadas quatro capturas de tela enviadas pela operação em 15/10/2026, cobrindo
Dashboard, Prospecção, Agendamentos e Funil.

### Padrão visual identificado

- Fundo escuro em camadas (`#050B1F` base, `#081d30` painel, `#0a2035` cartão interno) com
  bordas `#16314d` e cantos de 16 a 20 px.
- Acentos da marca: ciano `#00CBFF`, azul `#0f7fda` e laranja `#f97316`.
- Cabeçalhos de tabela em caixa alta, 10 px, com espaçamento entre letras.
- Badges coloridos por origem, ramo e etapa.
- Barras de progresso em gradiente ciano para as metas do dia e medidor semicircular para a
  meta do mês.
- Cartões de métrica com número grande colorido e ícone em caixa arredondada.
- Lista de agendamentos agrupada por dia, com barra vertical colorida e contagem de dias em
  destaque, acompanhada de calendário mensal lateral com contador por dia.

### Decisões visuais adotadas

- Criado o kit compartilhado `frontend/src/components/VendedorUi.tsx` com `Badge`, `GoalBar`,
  `GoalGauge`, `StatTile`, `DayCount`, `PanelCard`, `PageBanner`, `GoalStrip` e `TableHead`.
- A cor de cada badge é derivada do nome da origem por palavra-chave, com fallback
  determinístico por hash, mantendo o mesmo tom para o mesmo rótulo em todas as telas.
- Métricas sem endpoint correspondente nas referências foram substituídas por equivalentes
  reais: "Fechamentos dos últimos 90 dias" virou "Data a confirmar" e "Meu desempenho da
  semana" virou "Meu desempenho" com contagens derivadas das consultas já existentes.
- Busca global e filtros inertes do topo não foram reintroduzidos; cada tela traz apenas
  filtros com efeito real sobre a lista exibida.
- Os botões de adicionar meta e comissão das referências não foram implementados para o
  vendedor.

## Backend

O endpoint transacional `POST /opportunities/direct-lead` cria o lead e a oportunidade
própria na etapa inicial. Falhas de configuração do funil desfazem todo o cadastro.
As telas também consomem:
`GET /me/goals/today`, `GET /me/followups`, `GET /schedules`, `GET /opportunities`,
`GET /availabilities`, `GET /origins`, `GET /me/production` e `GET /me/bonus`.

## Frontend

- `frontend/src/components/VendedorUi.tsx`
- `frontend/src/features/vendedor/VendedorDashboard.tsx`
- `frontend/src/features/vendedor/ProspeccaoPage.tsx`
- `frontend/src/features/vendedor/AgendamentosPage.tsx`
- `frontend/src/features/vendedor/FunilPage.tsx`
- `frontend/src/features/vendedor/NewLeadDialog.tsx`

## Banco de dados

Sem impacto.

## API

- `POST /api/v1/opportunities/direct-lead` — exclusivo do vendedor, limitado aos produtos
  associados ao usuário e com organização derivada da sessão.

## Segurança

- Nenhum identificador de organização ou de outro vendedor é enviado pelo cliente.
- O produto é validado novamente no backend contra as associações do vendedor.
- Lead e oportunidade são persistidos atomicamente e ambos geram auditoria.
- O bônus exibido é sempre o do próprio usuário autenticado e some quando indisponível.

## Testes necessários

- Unitário: componentes do kit visual (`VendedorUi.test.tsx`).
- Interface: dashboard com dados e com erro (`VendedorDashboard.test.tsx`).
- Integração: criação transacional do lead no funil e rollback quando não há funil.
- Interface: envio do formulário de novo lead e ação contextual do cabeçalho.

## Histórico

- 2026-10-15 - Telas do vendedor alinhadas às referências visuais da operação.
- 2026-10-15 - Atalho de novo lead ligado à criação direta e transacional no funil.
