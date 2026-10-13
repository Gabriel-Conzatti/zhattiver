# Modelo de Dados

Consulte [modelo-dados.md](../../modelo-dados.md).

A recuperação de senha usa `password_reset_tokens`, vinculada à organização e ao
usuário. A tabela armazena apenas hash SHA-256, validade e instante de consumo.
