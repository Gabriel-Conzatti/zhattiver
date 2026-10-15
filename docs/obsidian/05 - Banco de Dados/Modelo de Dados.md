# Modelo de Dados

Consulte [modelo-dados.md](../../modelo-dados.md).

A recuperação de senha usa `password_reset_tokens`, vinculada à organização e ao
usuário. A tabela armazena apenas hash SHA-256, validade e instante de consumo.
# Sinistros

- `claim_statuses`: estados configuráveis por organização.
- `claims`: registro principal, vínculos comerciais opcionais, atribuição, datas e
  indenização em `NUMERIC(14,2)`.
- `claim_parties`: segurado, terceiro e demais participantes.
- `claim_events`: timeline operacional.
- `claim_tasks`: pendências, prazo, prioridade e conclusão.
- `claim_documents`: metadados para futura integração com storage privado.

Todos os registros pertencem à organização da sessão. Sinistros são arquivados por
`archived_at`, sem exclusão operacional.
