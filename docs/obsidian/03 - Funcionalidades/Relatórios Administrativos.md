# Relatórios Administrativos

## Objetivo

Oferecer ao administrador uma visão mensal consolidada da produção oficial.

## Regras de negócio

- Somente vendas validadas compõem os totais financeiros.
- A competência é o mês da data de fechamento.
- O relatório pode ser filtrado por vendedor e produto.
- Vendas pendentes, em revisão e canceladas aparecem apenas nas contagens de estado.

## Perfis autorizados

- Administrador.

## Backend

`GET /api/v1/admin/reports/production` retorna totais de vendas validadas, prêmio
líquido, comissão, contagens por estado e linhas agrupadas por vendedor/produto.

## Frontend

A rota `/admin/relatorios` apresenta filtros de ano, mês, vendedor e produto,
cards consolidados e tabela detalhada.

Referência visual adotada: componentes e hierarquia das telas administrativas
existentes (`Produção`, `Bônus` e `Auditoria`); não havia arquivo visual específico
de relatório no repositório.

## Segurança

- Organização derivada da sessão.
- Endpoint nega acesso a vendedor e SDR.
- Nenhum resultado de outra organização participa das agregações.
- Registro de venda rejeita vendedor, seguradora ou tipo de cliente de outro tenant.
- A consulta financeira reutiliza a elegibilidade centralizada da RN-038.

## Testes

- Autorização e isolamento multiempresa no backend.
- Exclusão financeira de estados não validados.
- Renderização da tela por Vitest.
- Fluxo integrado por Playwright.

## Histórico

- 2026-10-13 - Relatório mensal implementado e RN-072 verificada.
