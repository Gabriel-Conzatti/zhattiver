# Endpoints

Inventário canônico: [api.md](../../api.md).

Todas as rotas autenticadas derivam a organização da sessão; o cliente não
fornece `organization_id`.

## Relatórios administrativos

- `GET /api/v1/admin/reports/production`
  - acesso exclusivo de administrador;
  - filtros: `year`, `month`, `seller_user_id` e `product_id`;
  - retorna contagem por estado, totais validados e agrupamento por vendedor/produto;
  - valores financeiros consideram somente vendas validadas.
