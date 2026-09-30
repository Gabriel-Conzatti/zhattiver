# Modelo de dados (visão inicial)

Convenções gerais:

- Todas as tabelas de negócio possuem `organization_id UUID NOT NULL REFERENCES organizations(id)` e índice composto quando fizer sentido.
- PKs são `UUID` (v4) para evitar colisão em ambientes multi-tenant e migrações.
- `created_at`, `updated_at` como `TIMESTAMPTZ NOT NULL DEFAULT NOW()` com trigger de update.
- Soft delete via `archived_at TIMESTAMPTZ NULL` (nunca `DELETE` pela UI).
- Dinheiro como `NUMERIC(14, 2)`.
- Datas puras (vigência, feriado) como `DATE`.
- Instantes como `TIMESTAMPTZ` (UTC).

## Organização e usuários

### `organizations`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| slug | TEXT UNIQUE | subdomínio futuro |
| timezone | TEXT | default `America/Sao_Paulo` |
| created_at, updated_at | TIMESTAMPTZ | |
| archived_at | TIMESTAMPTZ NULL | |

### `users`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| email | CITEXT UNIQUE (por org) | |
| name | TEXT | |
| password_hash | TEXT | argon2id |
| role | ENUM('admin', 'vendedor', 'sdr') | perfil base |
| is_active | BOOLEAN | |
| last_login_at | TIMESTAMPTZ NULL | |
| created_at, updated_at, archived_at | | |

### `teams`

`id`, `organization_id`, `name`, `archived_at`.

### `team_members`

`team_id`, `user_id`, `role_in_team` — n:n com constraint única `(team_id, user_id)`.

### `products`

`id`, `organization_id`, `name`, `slug`, `is_active`, `archived_at`.

### `user_products`

n:n `user_id` × `product_id` (define MP-001 base).

### `permission_grants`

Concessões individuais (RN-071, MP-005/006).

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| user_id | UUID FK | quem recebe |
| granted_by | UUID FK users | quem concedeu |
| target_user_id | UUID FK NULL | usuário substituído (quando acesso ao funil alheio) |
| permission | TEXT | ex. `funnel.view`, `funnel.work`, `sales.validate`, `sales.edit_after_deadline`, `finance.view_premium`, `finance.view_commission_pct` |
| scope | JSONB | filtros extras (produto, equipe) |
| starts_at, ends_at | TIMESTAMPTZ NULL | vigência |
| reason | TEXT NULL | motivo |
| revoked_at | TIMESTAMPTZ NULL | revogação manual |

Índice: `(user_id, permission)` + `WHERE revoked_at IS NULL`.

### `sessions`

Metadados de sessão (opaco). Corpo real fica em Redis via Flask-Session.

## Calendário e configuração

### `holidays`

`id`, `organization_id NULL` (nacional = NULL, personalizado = FK), `date DATE`, `label TEXT`, `source TEXT`, `created_at`. Índice único `(organization_id, date)`.

### `settings`

Key-value versionado por vigência (feature flags, limites, textos institucionais).

## Lead e histórico

### `leads`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| kind | ENUM('pf', 'pj') | |
| name | TEXT | |
| document | TEXT NULL | CPF/CNPJ, criptografia futura |
| city | TEXT NULL | |
| state | CHAR(2) NULL | |
| indicator_name | TEXT NULL | |
| notes | TEXT NULL | |
| archived_at | | |

### `lead_phones`

`id`, `lead_id`, `phone_e164 TEXT NOT NULL` (normalizado), `original TEXT`, `is_primary BOOLEAN`. Índice único `(organization_id, phone_e164)` para duplicidade.

### `vehicles`

`id`, `lead_id`, `plate TEXT`, `model TEXT`, `year INT`, `notes TEXT`.

### `lead_products`

Situação conhecida por produto (para cross-sell). Colunas: `lead_id`, `product_id`, `status ENUM('has','none','unknown')`, `source TEXT`, `known_since DATE`.

### `tags` / `tag_categories` / `lead_tags`

Configurável, com categoria (origem, tipo cliente, produto possui, produto interesse).

### `origins`

Origens comerciais (Placas, Indicação, Renovação, Prospecção, Cliente ativo, Novo, ...).

## Entrada e disponibilização

### `import_batches`

`id`, `organization_id`, `type ENUM('leads','agendamentos')`, `status`, `filename`, `rows_total`, `rows_ok`, `rows_error`, `created_by`, `created_at`, `completed_at`, `checksum`.

### `import_rows`

`id`, `batch_id`, `line_no`, `payload JSONB`, `errors JSONB`, `status`.

### `availabilities`

Lead disponibilizado para produto/equipe (SDR → comercial).

## Agendamentos

### `schedules`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| lead_id | UUID FK | |
| product_id | UUID FK | |
| owner_user_id | UUID FK NULL | vendedor responsável (pode ficar em pendência admin) |
| coverage_end_date | DATE | data final da vigência (obrigatória) |
| date_confirmed | BOOLEAN | RN-010 |
| insurer_id | UUID FK NULL | |
| vehicle_id | UUID FK NULL | |
| state | ENUM('scheduled','in_window','contacted','resolved','expired','cancelled') | |
| origin | TEXT | |
| notes | TEXT | |
| resolved_at | TIMESTAMPTZ NULL | |
| previous_schedule_id | UUID FK NULL | reagendamento (RN-056..RN-059) |

Índices: `(organization_id, coverage_end_date)`, `(owner_user_id, state)`.

## Funil e oportunidades

### `funnels` / `funnel_stages`

Configurável por produto/equipe. `funnel_stages` tem `order`, `is_final BOOLEAN`, `message_template_id`.

### `message_templates`

`id`, `body TEXT` com placeholders (`{nome_cliente}`, `{nome_vendedor}`, `{nome_indicador}`). Versionado.

### `opportunities`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| lead_id | UUID FK | |
| product_id | UUID FK | |
| funnel_id | UUID FK | |
| current_stage_id | UUID FK | |
| owner_user_id | UUID FK | |
| state | ENUM('open','won','lost') | |
| origin | TEXT | |
| source_availability_id | UUID FK NULL | |
| source_schedule_id | UUID FK NULL | |
| opened_at | TIMESTAMPTZ | |
| closed_at | TIMESTAMPTZ NULL | |
| last_relevant_at | TIMESTAMPTZ | RN-016/019 |
| version | INT | otimista |

Constraint: única `(organization_id, lead_id, product_id) WHERE state = 'open'` — RN da decisão provisória (impede duplicação simultânea no mesmo produto).

### `activities`

Eventos: `copy_message`, `contact`, `call`, `note`, `response`, `stage_change`, `result`, `next_action_scheduled`, `next_action_done`. Colunas: `id`, `organization_id`, `opportunity_id`, `type`, `payload JSONB`, `actor_user_id`, `beneficiary_user_id NULL`, `idempotency_key TEXT UNIQUE NULL`, `occurred_at`.

### `next_actions`

`id`, `opportunity_id`, `type`, `due_at TIMESTAMPTZ`, `owner_user_id`, `state ENUM('open','done','cancelled')`, `origin ENUM('manual','auto')`, `generation_key TEXT UNIQUE NULL`.

## Vendas e produção

### `sales`

| Coluna | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| organization_id | UUID FK | |
| lead_id | UUID FK | |
| opportunity_id | UUID FK NULL | pode ser venda direta |
| product_id | UUID FK | |
| seller_user_id | UUID FK | vendedor beneficiário |
| insurer_id | UUID FK | |
| net_premium | NUMERIC(14,2) | |
| commission_pct | NUMERIC(6,4) | ex. 0.15 = 15% |
| commission_amount | NUMERIC(14,2) | calculado no backend |
| client_type_id | UUID FK | |
| closed_on | DATE | data de fechamento |
| registered_at | TIMESTAMPTZ | instante do servidor |
| edit_deadline_at | TIMESTAMPTZ | RN-034 |
| state | ENUM('registered','validated','revision_pending','cancelled') | |
| validated_at, validated_by | | |
| cancelled_at, cancelled_reason | | |
| version | INT | |

### `sales_revisions`

Alterações que ainda não substituíram a versão validada (RN-034 pós-prazo/pós-validação).

### `production_snapshots`

Snapshots mensais reproduzíveis com regras vigentes.

## Metas e bônus

### `goals`

Metas mensais/diárias com vigência por competência (`year`, `month`) e escopo (usuário, produto, tipo). Não sobrepor.

### `bonus_rules`

Faixas por produto/base (`net_premium` ou `count`), com `bracket_min`, `bracket_max NULL`, `bonus_kind ENUM('fixed','percent')`, `value`, `base ENUM('net_premium','installment','count')`, `effective_from DATE`.

### `bonus_calculations`

Apuração mensal por vendedor/produto com snapshot da regra aplicada.

### `bonus_payments`

`predicted_on DATE` (dia 20 do mês seguinte), `paid_at TIMESTAMPTZ NULL`, `paid_amount NUMERIC`, `state ENUM('predicted','approved','paid','cancelled')`.

## Gestão

### `absences`

Ausências e substituto. `starts_on`, `ends_on`, `substitute_user_id`, `notes`.

### `transfers`

Transferências de oportunidades/agendamentos/follow-ups com `from_user_id`, `to_user_id`, `reason`, `entity_type`, `entity_id`, `created_at`.

### `cross_sell_lists` / `cross_sell_items`

Pré-listas administrativas, com liberação parcial.

### `notifications`

Notificações internas com deduplicação por `dedup_key`.

## Auditoria

### `audit_logs`

| Coluna | Tipo | Notas |
|---|---|---|
| id | BIGSERIAL PK | |
| organization_id | UUID | |
| actor_user_id | UUID NULL | pode ser sistema |
| entity_type | TEXT | |
| entity_id | UUID NULL | |
| action | TEXT | |
| before | JSONB NULL | apenas campos permitidos |
| after | JSONB NULL | |
| reason | TEXT NULL | |
| request_id | UUID NULL | correlação |
| occurred_at | TIMESTAMPTZ | |

A aplicação usa credencial sem privilégios `UPDATE`/`DELETE` sobre `audit_logs` em produção. Migrações usam credencial separada.

## Índices e restrições críticos

- `UNIQUE (organization_id, phone_e164)` em `lead_phones` — RN-076/077.
- `UNIQUE (idempotency_key)` em `activities` — RN-006/007.
- `UNIQUE (organization_id, lead_id, product_id) WHERE state='open'` em `opportunities`.
- `UNIQUE (organization_id, date)` em `holidays`.
- `CHECK (net_premium >= 0)`, `CHECK (commission_pct >= 0 AND commission_pct <= 1)`.
- `EXCLUDE USING gist` para vigências não sobrepostas em `goals` e `bonus_rules` (extensão `btree_gist`).

## Notas de multi-tenant

- Todas as FKs cruzam apenas dentro da mesma organização — reforçado por CHECK/trigger ou constraint composta.
- Nenhuma consulta aceita `organization_id` externo. O middleware injeta a partir da sessão em cada request.
