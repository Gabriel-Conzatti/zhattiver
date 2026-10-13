# Recuperação de Senha

## Objetivo

Permitir que um usuário ativo recupere o acesso sem intervenção administrativa e
sem revelar se um email está cadastrado.

## Fluxo principal

1. O usuário informa o email na tela pública.
2. A API retorna uma mensagem genérica.
3. Para uma conta ativa e fora do intervalo anti-spam, o sistema cria um token
   aleatório e envia o link por SMTP.
4. O usuário informa e confirma uma nova senha.
5. O token é consumido e todas as sessões anteriores são invalidadas.

## Backend

- Token gerado com `secrets.token_urlsafe(32)`.
- Persistência somente do hash SHA-256.
- Validade padrão de 30 minutos.
- Uso único e invalidação de tokens anteriores.
- Intervalo padrão de 60 segundos entre envios para a mesma conta.

## Frontend

- `/recuperar-senha` solicita o email.
- `/redefinir-senha?token=...` valida senha e confirmação.
- O login possui o acesso “Esqueci minha senha”.

## Segurança

- A resposta não distingue conta existente, inexistente, inativa ou em cooldown.
- O link usa exclusivamente `LYNK_PUBLIC_URL` ou o domínio configurado, nunca o
  cabeçalho `Host` da requisição.
- Token, senha e hash de senha não são registrados na auditoria ou nos logs.
- Falha SMTP invalida o token emitido e mantém a resposta pública genérica.

## Configuração

- `LYNK_PUBLIC_URL`
- `LYNK_SMTP_HOST`, `LYNK_SMTP_PORT`, `LYNK_SMTP_USERNAME`,
  `LYNK_SMTP_PASSWORD` e `LYNK_SMTP_FROM`
- `LYNK_PASSWORD_RESET_TTL_MINUTES`
- `LYNK_PASSWORD_RESET_COOLDOWN_SECONDS`

## Histórico

- 2026-10-14 - Fluxo seguro implementado no backend, frontend e testes.
