# Perfil e segurança da conta

## Objetivo

Permitir que qualquer usuário autenticado atualize o próprio nome e altere a senha sem
depender de um administrador, preservando a segurança das sessões abertas.

## Regras

- E-mail, perfil, organização, produtos e permissões não podem ser alterados pelo usuário.
- A alteração de senha exige a senha atual.
- A nova senha deve ter pelo menos 10 caracteres e ser diferente da atual.
- Senhas são armazenadas somente como hash Argon2id.
- Senhas, hashes e cookies não são gravados na auditoria.
- A troca de senha mantém a sessão que executou a operação e invalida todas as outras.
- O reset de senha feito por administrador invalida todas as sessões do usuário afetado.

## Invalidação de sessões

Cada usuário possui `session_version`. O login grava essa versão na sessão. Requisições
autenticadas cuja versão não corresponde ao usuário recebem `401 session_invalidated` e a
sessão é removida.

Trocas e resets de senha incrementam `session_version`. No fluxo de autoatendimento, a
sessão atual recebe a nova versão após a confirmação da alteração.

No primeiro deploy da migration, sessões criadas antes desse mecanismo não possuem
`auth_version` e precisarão autenticar novamente.

## Interface

A página **Meu perfil** está disponível para vendedor, SDR e administrador. Ela apresenta:

- nome editável;
- e-mail e perfil somente leitura;
- formulário separado para troca de senha;
- estados de validação, processamento, erro e sucesso.

## Auditoria

- `profile_update`: registra apenas nome anterior e novo.
- `password_change`: registra somente que outras sessões foram invalidadas.
- Reset administrativo continua registrado pelo evento de atualização do usuário, sem
  incluir senha ou hash.
