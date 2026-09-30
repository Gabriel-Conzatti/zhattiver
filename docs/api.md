# API v1

Base: `/api/v1`. Todas as rotas retornam JSON. Erros seguem o envelope:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Descrição legível",
    "details": {"field": "reason"},
    "requestId": "uuid"
  }
}
```

Autenticação por cookie de sessão (`HttpOnly`, `SameSite=Lax`, `Secure` em produção). Para mutações, envie o header `X-CSRF-Token` (valor lido do cookie `lynk_csrf`). Rotas idempotentes aceitam `Idempotency-Key`.

## Saúde

- `GET /health` — retorna `{ "status": "ok", "time": "..." }`.

## Autenticação

- `POST /auth/login` — body `{ "email", "password" }`. Sucesso: `{ "user": { ... } }`. Falha: `401`.
- `POST /auth/logout` — invalida sessão. `204`.
- `GET /auth/me` — retorna usuário logado com perfil, permissões e produtos autorizados. `401` se anônimo.

## Convenções (a expandir nas próximas etapas)

- Listagens: `?page=1&per_page=25&order=-created_at&filter[campo]=valor`.
- Ordens permitidas por endpoint são fixas — evita full scans e injeção.
- Datas em ISO 8601 UTC. O cliente formata para `America/Sao_Paulo`.
- Dinheiro serializado como string decimal: `"1234.56"`.
- IDs sempre em UUID string.
- Nenhum endpoint aceita `organization_id` — o backend deriva da sessão.

## Endpoints planejados (etapas seguintes)

- `POST /orgs/bootstrap` (setup inicial via CLI, não pela API pública).
- `GET/POST /users`, `PATCH /users/{id}`, `POST /users/{id}/grants`.
- `GET/POST /leads`, `GET /leads/{id}/history`, `POST /leads/import`.
- `GET/POST /schedules`, `POST /schedules/{id}/resolve`, `POST /schedules/{id}/contact`.
- `GET/POST /opportunities`, `POST /opportunities/{id}/copy-message`, `POST /opportunities/{id}/next-action`, `POST /opportunities/{id}/win`, `POST /opportunities/{id}/lose`.
- `GET/POST /sales`, `POST /sales/{id}/validate`, `POST /sales/{id}/cancel`.
- `GET /goals`, `GET /bonus/current`, `POST /admin/bonus/{id}/pay`.
- `GET /cross-sell/lists`, `POST /cross-sell/lists/{id}/release`.
- `GET /reports/*` — apenas admin.
- `GET /audit` — apenas admin.

Cada endpoint terá documentação detalhada (parâmetros, corpo, códigos) quando o módulo correspondente for implementado.
