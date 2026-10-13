# Endpoints

Inventário canônico: [api.md](../../api.md).

Todas as rotas autenticadas derivam a organização da sessão; o cliente não
fornece `organization_id`.

## Recuperação de senha

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

A solicitação sempre responde da mesma forma para não revelar contas. Tokens são
aleatórios, armazenados somente como hash, expiram, aceitam um único uso e invalidam
todas as sessões quando a senha é redefinida.

## Relatórios administrativos

- `GET /api/v1/admin/reports/production`
  - acesso exclusivo de administrador;
  - filtros: `year`, `month`, `seller_user_id` e `product_id`;
  - retorna contagem por estado, totais validados e agrupamento por vendedor/produto;
  - valores financeiros consideram somente vendas validadas.

## Catálogos administrativos

- `GET /api/v1/admin/catalogs`
- `POST /api/v1/admin/catalogs/{tipo}`
- `PATCH /api/v1/admin/catalogs/{tipo}/{id}`

Tipos: `products`, `origins`, `client-types`, `insurers`, `tag-categories` e
`tags`. As mutações são exclusivas de administrador, auditadas e usam arquivamento
reversível em vez de exclusão.
