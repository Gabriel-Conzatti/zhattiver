# Produção, Metas e Bônus

## Objetivo

Apurar o resultado comercial mensal sem antecipar vendas ainda não validadas.

## Regras de negócio

- Somente vendas no estado `validated` compõem produção, progresso de metas e bônus.
- A competência usa a data de fechamento da venda.
- A apuração é isolada por organização, vendedor e produto.
- Vendas registradas, em revisão ou canceladas não entram em apurações vivas.
- Pagamentos de bônus concluídos preservam seu snapshot histórico.
- Metas podem ser gerais ou específicas por produto e são únicas por competência.
- Faixas começam e terminam em limites mensais, sem sobreposição.
- Alterações de faixa são feitas encerrando a vigência atual e publicando uma nova.
- Bônus previstos podem ser aprovados, pagos ou cancelados com justificativa.

## Backend

A consulta de elegibilidade é centralizada no serviço de bônus e reutilizada pelos
resumos de produção, cálculo de bônus e atualização administrativa de previsões.
Metas e regras validam vendedor e produto contra a organização autenticada. Criação,
atualização, encerramento e cancelamento geram auditoria na mesma transação.

## Frontend

A página administrativa **Metas e bônus** possui três áreas:

1. apuração mensal com nomes de vendedor/produto e transições administrativas;
2. metas por competência, vendedor e produto;
3. faixas de bônus com base, intervalo, tipo, valor e vigência.

Todos os fluxos possuem carregamento, vazio, erro e confirmação de sucesso.

## Segurança

O `organization_id` sempre vem do contexto autenticado e participa de todas as
consultas de apuração.

## Testes

- Integração com todos os estados de venda relevantes.
- Isolamento entre organizações.
- Filtro por produto, vendedor e competência.
- Rejeição de produto externo e faixa sobreposta.
- Auditoria de criação/alteração de meta e cancelamento de bônus.
- Vitest dos formulários administrativos.

## Histórico

- 2026-10-13 - RN-038 verificada e filtro de elegibilidade centralizado.
- 2026-10-13 - RN-043..RN-051 verificadas e gestão administrativa concluída.
