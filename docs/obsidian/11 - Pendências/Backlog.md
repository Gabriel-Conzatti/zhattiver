# Backlog

1. Definir a meta diária de prospecção da vendedora na tela Equipe.
2. Cadastrar metas mensais e faixas de bônus antes da primeira apuração.
3. Executar os cenários E2E contra o domínio público.
4. Homologar os fluxos comerciais e converter as RN `🟨` em `✅`.
5. Incluir Ruff e ESLint no workflow de CI.

## Adiados pela operação

- Criar usuário SDR. O administrador cobre cadastro e disponibilização de leads no
  início da operação.
- Ativar a recuperação de senha por e-mail. A operação optou por entrar em produção sem
  SMTP. O caminho oficial para esquecimento de senha é a redefinição administrativa em
  Equipe > Editar, já validada em produção. Quando houver decisão de retomar, basta criar
  a senha exclusiva da caixa Locaweb e executar `/root/configure-smtp.py` na VPS.

## Concluídos

- Homologar o deploy na VPS (2026-10-14).
- Testar backup e restauração (2026-10-14, restauração validada em banco separado).
- Validar login autenticado e módulos administrativos no domínio público (2026-10-14).

Consulte também [PROGRESS.md](../../../PROGRESS.md).
