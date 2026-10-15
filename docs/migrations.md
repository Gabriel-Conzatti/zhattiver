# Migrations

## Aplicação

```powershell
cd backend
flask --app wsgi:app db upgrade
```

Em produção, a aplicação da migration deve ocorrer antes da substituição dos containers da
API, worker e scheduler.

## Histórico

### `b4c91e8d2f60` — catálogos e oficinas de sinistros

- Cria `claim_branches`, `claim_workshops` e `claim_workshop_insurers`.
- Adiciona `branch_id`, `insurer_id` e `workshop_id` a `claims`, preservando os campos de
  nome existentes como fotografia histórica.
- Semeia Auto, RE e RCO ONIBUS, além das 14 seguradoras confirmadas pela operação,
  incluindo Suhai, para todas as organizações existentes.
- Converte ramos e seguradoras já usados em sinistros em entradas de catálogo antes de
  tornar as novas FKs obrigatórias.
- Rollback: `flask --app wsgi:app db downgrade 7d2f4c8a91be`.
- O downgrade remove os vínculos e cadastros de oficinas criados após o upgrade, mas não
  altera os nomes históricos já armazenados em `claims`.

### `7d2f4c8a91be` — módulo inicial de sinistros

- Cria estados, sinistros, participantes, eventos, tarefas e metadados de documentos.
- Semeia seis estados padrão para organizações existentes.
- Rollback: `flask --app wsgi:app db downgrade 6c9e0b4d7a12`.

### `6c9e0b4d7a12` — unicidade de metas mensais

- Adiciona índices únicos parciais separados para metas gerais e metas por produto.
- Impede duplicidade de metas gerais mesmo quando `product_id` é nulo no PostgreSQL.
- Rollback: `flask --app wsgi:app db downgrade 4b7ac198d21e`.
- O downgrade remove somente os índices; nenhuma meta é apagada.

### `4b7ac198d21e` — tokens de recuperação de senha

- Cria `password_reset_tokens` com organização, usuário, hash SHA-256 do token, validade
  e instante de uso.
- O token bruto existe somente no link enviado por email; o banco mantém apenas o hash.
- Registros usados ou expirados permanecem para rastreabilidade e podem ser removidos
  posteriormente por política de retenção.
- Rollback: `flask --app wsgi:app db downgrade 8f28a73b9c11`.
- O downgrade remove tokens pendentes e invalida links já enviados.

### `8f28a73b9c11` — versão de sessão do usuário

- Adiciona `users.session_version INTEGER NOT NULL DEFAULT 1`.
- Sessões anteriores passam a exigir nova autenticação porque não possuem `auth_version`.
- Rollback: `flask --app wsgi:app db downgrade 1ea62d17932e`.
- O downgrade remove apenas a coluna; não altera senhas.

### `1ea62d17932e` — schema inicial

- Cria o schema base da aplicação.

## Validação

- O grafo Alembic deve possuir um único head.
- A migration deve ser executada em PostgreSQL 16 na CI/homologação antes da produção.
- Para `b4c91e8d2f60`, validar três ramos, 14 seguradoras e o ciclo
  upgrade/downgrade/upgrade antes do deploy.
- Após upgrade, validar login, troca de senha, recuperação por email, invalidação de uma
  segunda sessão e cadastro de meta geral/por produto.
