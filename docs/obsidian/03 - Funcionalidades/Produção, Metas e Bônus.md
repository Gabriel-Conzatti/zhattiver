# Produção, Metas e Bônus

## Objetivo

Apurar o resultado comercial mensal sem antecipar vendas ainda não validadas.

## Regras de negócio

- Somente vendas no estado `validated` compõem produção, progresso de metas e bônus.
- A competência usa a data de fechamento da venda.
- A apuração é isolada por organização, vendedor e produto.
- Vendas registradas, em revisão ou canceladas não entram em apurações vivas.
- Pagamentos de bônus concluídos preservam seu snapshot histórico.

## Backend

A consulta de elegibilidade é centralizada no serviço de bônus e reutilizada pelos
resumos de produção, cálculo de bônus e atualização administrativa de previsões.

## Segurança

O `organization_id` sempre vem do contexto autenticado e participa de todas as
consultas de apuração.

## Testes

- Integração com todos os estados de venda relevantes.
- Isolamento entre organizações.
- Filtro por produto, vendedor e competência.

## Histórico

- 2026-10-13 - RN-038 verificada e filtro de elegibilidade centralizado.
