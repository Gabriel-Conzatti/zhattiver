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

## Usuários e meta diária

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{id}`

O `PATCH` aceita `daily_prospecting_quota` e `quota_effective_from` para vendedores.
Uma nova vigência encerra a anterior no dia imediatamente anterior, sem apagar o
histórico. A mutação é exclusiva de administrador e auditada.

## Prospecção

- `POST /api/v1/leads`
- `POST /api/v1/availabilities`

Administrador e SDR podem cadastrar e disponibilizar leads. A interface administrativa
expõe esse fluxo para que a operação não dependa da existência de um usuário SDR.

## Lead direto do vendedor

- `POST /api/v1/opportunities/direct-lead`

Exclusivo do vendedor. Recebe nome, telefone, produto e localização opcional; valida o
produto contra as associações do usuário e cria lead + oportunidade na etapa inicial em
uma única transação.

## Catálogos administrativos

- `GET /api/v1/admin/catalogs`
- `POST /api/v1/admin/catalogs/{tipo}`
- `PATCH /api/v1/admin/catalogs/{tipo}/{id}`

Tipos: `products`, `origins`, `client-types`, `insurers`, `tag-categories` e
`tags`. As mutações são exclusivas de administrador, auditadas e usam arquivamento
reversível em vez de exclusão.

## Metas e bônus

- `GET/POST /api/v1/monthly-goals`
- `GET/POST /api/v1/bonus-rules`
- `PATCH /api/v1/bonus-rules/{id}`
- `GET /api/v1/admin/bonus`
- `POST /api/v1/admin/bonus/refresh`
- `POST /api/v1/admin/bonus/{id}/approve`
- `POST /api/v1/admin/bonus/{id}/pay`
- `POST /api/v1/admin/bonus/{id}/cancel`

As mutações são exclusivas de administrador, derivam a organização da sessão e geram
auditoria. Metas fazem upsert por competência; faixas são versionadas e não aceitam
sobreposição de vigência e intervalo. O limite superior é exclusivo e o valor fixo é
aplicado por negócio validado.
# Sinistros

- `GET /api/v1/claims/statuses`
- `POST/PATCH /api/v1/claims/statuses`
- `GET/POST /api/v1/claims`
- `GET /api/v1/claims/assignees`
- `GET/PATCH /api/v1/claims/{id}`
- `POST /api/v1/claims/{id}/assign`
- `POST /api/v1/claims/{id}/status`
- `GET/POST /api/v1/claims/{id}/events`
- `POST /api/v1/claims/{id}/parties`
- `GET/POST /api/v1/claims/{id}/tasks`
- `PATCH /api/v1/claims/{id}/tasks/{task_id}`
- `POST /api/v1/claims/{id}/archive`

Todas as rotas derivam a organização da sessão. Operações exigem administrador ou
`claims.manage`; consulta aceita `claims.read` e o vendedor somente dentro do escopo
comercial próprio.
