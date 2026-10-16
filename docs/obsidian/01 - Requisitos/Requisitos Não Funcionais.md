# Requisitos Não Funcionais

- Isolamento multiempresa e autorização no backend.
- Sessões antigas são invalidadas ao alterar perfil, senha ou estado ativo do usuário.
- Chaves de produção para sessão e CSRF não podem usar placeholders e devem ter no mínimo
  32 bytes; `LYNK_ENV` desconhecido impede o boot.
- Rate limit de login é por conta e IP normalizado (sem porta TCP de origem), com estado
  distribuído no Redis.
- Referências entre registros devem ser validadas quanto ao pertencimento à organização.
- Dinheiro em `NUMERIC`/`Decimal`.
- Instantes em UTC e apresentação em `America/Sao_Paulo`.
- PostgreSQL 16, Redis 7 e execução reproduzível por Docker Compose.
- Testes backend, frontend e E2E como barreiras de CI.

Consulte [arquitetura.md](../../arquitetura.md).
