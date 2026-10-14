# Migrations

Consulte [migrations.md](../../migrations.md).

Nunca editar migrations já aplicadas em produção.

Head atual: `6c9e0b4d7a12`, que adiciona índices únicos parciais para metas mensais
gerais e por produto. O rollback para `4b7ac198d21e` remove somente esses índices.
