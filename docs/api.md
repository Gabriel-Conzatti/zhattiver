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
- `POST /auth/forgot-password` — body `{ email }`. Sempre retorna `202` com a mesma
  mensagem para contas existentes, inexistentes ou dentro do intervalo anti-spam. O link é
  enviado somente para usuário ativo; o token bruto nunca é persistido.
- `POST /auth/reset-password` — body `{ token, new_password }`. Consome um token válido
  uma única vez, redefine a senha e invalida todas as sessões. Retorna `204`.
  - `422 invalid_password_reset_token`: token inválido, expirado ou já utilizado.
  - `422 password_unchanged`: a nova senha é igual à senha atual.
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
- `GET/POST /monthly-goals` — metas mensais administrativas por vendedor/produto.
- `GET/POST /bonus-rules`, `PATCH /bonus-rules/{id}` — faixas e encerramento de vigência.
- `GET /me/production`, `GET /me/bonus` — produção e bônus do próprio usuário.
- `GET /admin/bonus`, `POST /admin/bonus/refresh`,
  `POST /admin/bonus/{id}/approve|pay|cancel`.
- `GET /cross-sell/lists`, `POST /cross-sell/lists/{id}/release`.
- `GET /reports/*` — apenas admin.

Cada endpoint terá documentação detalhada (parâmetros, corpo, códigos) quando o módulo correspondente for implementado.
# Sinistros

- `GET /api/v1/claims/statuses` — estados disponíveis da organização.
- `POST/PATCH /api/v1/claims/statuses` — configuração de estados pelo administrador.
- `GET /api/v1/claims` — lista paginada e filtrável por busca (segurado, placa,
  seguradora, ramo e número), status, situação (`state=open|closed`), responsável e
  seguradora. Cada item traz `insured_name` e `next_follow_up_on` (próximo acompanhamento
  em aberto).
- `GET /api/v1/claims/dashboard` — sinistros em aberto, acompanhamentos agendados para
  hoje e lista de acompanhamentos do dia e atrasados.
- `GET /api/v1/claims/assignees` — responsáveis da organização para atribuição.
- `POST /api/v1/claims` — cadastro por administrador ou concessão `claims.manage`. Exige
  segurado com nome, CPF/CNPJ e telefone, `service_type`
  (`terceiro|segurado|segurado_terceiro`), responsável e os dados do item conforme o ramo
  (`vehicle`: placa, modelo e ano; `property`: endereço e cobertura). Status e data de
  abertura são opcionais (padrão: primeiro status não terminal e data atual).
- `GET /api/v1/claims/{id}` — detalhe com participantes, eventos e tarefas.
- `PATCH /api/v1/claims/{id}` — edição por administrador ou concessão `claims.manage`.
- `POST /api/v1/claims/{id}/assign` — atribuição de responsável.
- `POST /api/v1/claims/{id}/status` — alteração de status.
- `GET/POST /api/v1/claims/{id}/events` — consulta e registro de atualização; aceita
  `occurred_at` opcional, que não pode estar no futuro.
- `PATCH /api/v1/claims/{id}/events/{event_id}` — ajusta `occurred_at` de uma atualização
  registrada manualmente (`event_type=note`); eventos do sistema retornam `409`.
- `POST /api/v1/claims/{id}/parties` — inclusão de participante.
- `GET/POST /api/v1/claims/{id}/tasks` — consulta e criação de pendência.
- `PATCH /api/v1/claims/{id}/tasks/{task_id}` — conclusão ou reabertura de pendência.
- `POST /api/v1/claims/{id}/archive` — arquivamento com motivo.
- `POST /api/v1/claims/workshops`, `PATCH /api/v1/claims/workshops/{id}` e
  `POST /api/v1/claims/workshops/{id}/archive` — cadastro, edição (inclui `city`) e
  arquivamento de oficinas.
- `GET /api/v1/claims/insurers` — seguradoras ativas com contatos, contato de carro
  reserva e observações da equipe de sinistros.
- `PUT /api/v1/claims/insurers/{insurer_id}/profile` — grava essas informações
  (administrador ou `claims.manage`).

O vendedor consulta somente sinistros ligados a lead, oportunidade ou venda do seu escopo
comercial. Valores de indenização são omitidos sem perfil administrador, `claims.manage`
ou concessão `claims.view_financial`.

# Leads, importações e agendamentos

- `POST /api/v1/leads` e `PATCH /api/v1/leads/{id}` — aceitam `postal_code` opcional
  (8 dígitos, gravado como `00000-000`). O `PATCH` também aceita `phones`, que substitui os
  telefones respeitando a regra de duplicidade (`409 duplicate_lead`).
- `GET /api/v1/leads` — cada item traz `released` quando o lead já foi disponibilizado.
- `POST /api/v1/leads/{id}/deletion-request` — SDR/admin excluem o lead: ele é arquivado e
  vai para avaliação do administrador. Leads com oportunidade retornam `409 lead_in_use`.
- `GET /api/v1/lead-deletion-requests` — pendências de avaliação (somente admin).
- `POST /api/v1/lead-deletion-requests/{id}/approve|reject` — confirma a exclusão ou
  restaura o lead.
- `POST /api/v1/imports/{id}/discard` — descarta lote ainda em revisão. Depois de
  confirmado, as linhas trazem `lead_id` e `lead_state` para exclusão individual.
- `POST /api/v1/schedules` — aceita `lead_id` ou `new_lead { name, phone, postal_code?,
  city?, state? }` (exatamente um). O novo cliente passa pela validação de telefone
  duplicado (`409 duplicate_lead` com o lead existente em `details`).
