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

- `POST /auth/login` — body `{ "email", "password" }`. Sucesso: usuário autenticado.
  - `401 invalid_credentials`: credenciais inválidas, sem revelar se a conta existe.
  - `429 too_many_login_attempts`: limite por conta ou origem atingido; inclui `Retry-After`.
  - `503 auth_temporarily_unavailable`: Redis do controle de tentativas indisponível. A
    autenticação falha fechada, sem ignorar o controle.
- `POST /auth/logout` — invalida sessão. `204`.
- `GET /auth/me` — retorna usuário logado com perfil, permissões e produtos autorizados. `401` se anônimo.
- `PATCH /auth/profile` — altera somente o nome do próprio usuário. Retorna o usuário
  atualizado. Exige CSRF.
- `POST /auth/change-password` — body `{ current_password, new_password }`. Exige senha
  atual válida, nova senha com pelo menos 10 caracteres e CSRF. Retorna `204`, mantém a
  sessão atual e invalida as demais.
- Requisições com versão de sessão antiga retornam `401 session_invalidated`.

## Convenções (a expandir nas próximas etapas)

- Listagens: `?page=1&per_page=25&order=-created_at&filter[campo]=valor`.
- Ordens permitidas por endpoint são fixas — evita full scans e injeção.
- Datas em ISO 8601 UTC. O cliente formata para `America/Sao_Paulo`.
- Dinheiro serializado como string decimal: `"1234.56"`.
- IDs sempre em UUID string.
- Nenhum endpoint aceita `organization_id` — o backend deriva da sessão.

## Auditoria

- `GET /audit` — lista os registros de auditoria da organização da sessão. Exclusivo para
  administradores (`403` para os demais perfis). Não aceita `organization_id`.
  - Filtros opcionais exatos: `actor_user_id`, `entity_type`, `entity_id`, `action`.
  - Paginação: `page` (padrão `1`) e `per_page` (padrão `25`, máximo `200`).
  - A resposta contém `{ items, page, per_page, total }`. Os itens são ordenados por
    `occurred_at` decrescente e, em empate, por `id` decrescente.
  - Cada item inclui o ator, entidade, ação, valores anteriores/novos permitidos, motivo e
    instante UTC.

## Configurações administrativas

Todas as mutações abaixo são exclusivas de administrador, exigem CSRF e geram auditoria.
IDs vinculados precisam pertencer à organização da sessão.

- `GET /admin/funnels` — lista funis ativos com suas etapas ativas.
- `POST /admin/funnels` — cria funil com `{ product_id, name, is_default }`.
- `PATCH /admin/funnels/{id}` — altera `{ name, is_default, archived }`.
- `POST /admin/funnels/{id}/stages` — cria etapa com nome, ordem, estado inicial/final e
  mensagem opcional.
- `PATCH /admin/funnel-stages/{id}` — altera a etapa ou a arquiva.
- `GET /loss-reasons?include_inactive=true` — administrador pode incluir itens inativos.
- `POST /loss-reasons` e `PATCH /loss-reasons/{id}` — cria, renomeia, desativa ou reativa
  motivo de perda.
- `GET /next-action-types?include_inactive=true` — administrador pode incluir itens inativos.
- `POST /next-action-types` e `PATCH /next-action-types/{id}` — cria, renomeia, desativa ou
  reativa tipo de próxima ação.

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

Cada endpoint terá documentação detalhada (parâmetros, corpo, códigos) quando o módulo correspondente for implementado.
