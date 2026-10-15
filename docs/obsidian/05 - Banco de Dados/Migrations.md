# Migrations

Consulte [migrations.md](../../migrations.md).

Nunca editar migrations já aplicadas em produção.

Head local: `7d2f4c8a91be`, que adiciona o domínio de sinistros, seus índices, constraints
e os seis estados padrão para organizações existentes. O downgrade remove somente as
tabelas e índices do módulo. A migration ainda não foi aplicada em produção.

O código, a configuração do Compose e o ciclo upgrade/downgrade/upgrade em PostgreSQL 16
foram validados localmente em 2026-10-16.
