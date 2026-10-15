# Migrations

Consulte [migrations.md](../../migrations.md).

Nunca editar migrations já aplicadas em produção.

Head local: `b4c91e8d2f60`, que cria catálogos de ramos, oficinas e vínculos entre oficinas
e seguradoras. A migration adiciona FKs de ramo, seguradora e oficina a `claims`, preserva
os nomes históricos e semeia três ramos e 14 seguradoras por organização, incluindo Suhai.

Produção está em `b4c91e8d2f60` desde 2026-10-15. O rollback é
`flask db downgrade 7d2f4c8a91be`; ele remove os novos cadastros e vínculos, sem alterar os
nomes históricos armazenados nos sinistros.

O grafo com head único, o ciclo upgrade/downgrade/upgrade em PostgreSQL 16 e a semeadura
exata de 3 ramos e 14 seguradoras foram validados localmente em 2026-10-15.

Na aplicação em produção o catálogo global de seguradoras já continha entradas anteriores
criadas pelo módulo comercial, então a semeadura somou nomes novos aos existentes em vez de
substituí-los. Entradas antigas equivalentes continuam ativas porque estão referenciadas por
vendas e agendamentos.
