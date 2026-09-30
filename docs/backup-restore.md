# Backup e restauração

## Escopo

- Banco PostgreSQL (todos os dados de negócio + auditoria).
- Arquivos privados (uploads/importações) — quando esse módulo for implementado.
- Certificados do Caddy (regenera automaticamente, mas recomenda-se preservar).

Backup somente no mesmo disco da VPS **não** protege contra perda da VPS. Envie uma cópia para armazenamento externo (S3/B2/rsync SSH).

## Backup manual

```bash
cd /opt/lynk/app
mkdir -p /opt/lynk/backups
docker compose exec -T db pg_dump -U $POSTGRES_USER -Fc $POSTGRES_DB \
  > /opt/lynk/backups/lynk-$(date +%F-%H%M).dump
```

Use `-Fc` (custom) — necessário para `pg_restore`.

## Backup automático

O script `scripts/backup.sh` faz o dump com data e limpa backups antigos (retenção padrão 14 dias). Agende com `cron`:

```
0 3 * * * /opt/lynk/app/scripts/backup.sh >> /var/log/lynk-backup.log 2>&1
```

## Restauração

**Sempre** restaure em ambiente separado antes de considerar válido.

```bash
# Prepare um banco vazio (não sobrescreva produção sem testar antes):
createdb -h ... -U ... lynk_restore

# Restaure:
pg_restore -h ... -U ... -d lynk_restore --clean --if-exists /caminho/lynk-YYYY-MM-DD.dump

# Aponte um ambiente de staging para lynk_restore e verifique login, contagens, integridade.
```

## Rollback de aplicação

- Aplicação: `git checkout <tag anterior>` + `docker compose up -d --build`.
- Banco: **não** rode `flask db downgrade` sem backup fresco. Migrações destrutivas exigem procedimento manual documentado.

## Verificação de integridade

Após restaurar:

```sql
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM audit_logs;
SELECT MAX(occurred_at) FROM audit_logs;
```

Sempre confronte com o último backup bem-sucedido e o log de operação do dia.
