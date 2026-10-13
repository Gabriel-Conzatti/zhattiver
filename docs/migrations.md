# Migrations

## Aplicação

```powershell
cd backend
flask --app wsgi:app db upgrade
```

Em produção, a aplicação da migration deve ocorrer antes da substituição dos containers da
API, worker e scheduler.

## Histórico

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
- Após upgrade, validar login, troca de senha e invalidação de uma segunda sessão.
