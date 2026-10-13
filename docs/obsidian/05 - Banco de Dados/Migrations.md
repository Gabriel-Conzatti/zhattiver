# Migrations

Consulte [migrations.md](../../migrations.md).

Nunca editar migrations já aplicadas em produção.

Head atual: `4b7ac198d21e`, que cria `password_reset_tokens`. O rollback para
`8f28a73b9c11` remove os tokens e invalida links ainda pendentes.
