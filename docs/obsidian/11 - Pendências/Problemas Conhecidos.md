# Problemas Conhecidos

- Identificadores técnicos `LYNK_*` permanecem por compatibilidade.
- Warnings de depreciação do backend de sessão filesystem aparecem apenas nos testes;
  produção usa Redis.
- SMTP permanece sem credencial em produção, agora por decisão da operação, que optou por
  entrar no ar sem recuperação de senha por e-mail. DNS confirma Email Locaweb; a VPS
  alcança `email-ssl.com.br:587` por STARTTLS e o servidor exige `AUTH PLAIN/LOGIN`. O
  endpoint legado `smtp.locaweb.com.br` não responde. O configurador seguro
  `/root/configure-smtp.py` segue instalado para quando a decisão for revista.
  **Não bloqueia o go-live**: a redefinição administrativa de senha foi validada em
  produção e é o caminho oficial para esquecimento de senha.
- `MonthlyGoal` e `BonusRule` não possuem nenhum registro em produção. Sem cadastro
  prévio, metas e apuração de bônus não produzem resultado.
- A meta diária de prospecção da vendedora ainda precisa receber o valor definido pela
  operação. A configuração passa a ser feita em **Equipe > Editar vendedor**.
- A porta 80 não responde externamente e o Caddy roda com `auto_https disable_redirects`.
  Quem digita o domínio sem `https://` não é redirecionado. A emissão e a renovação do
  certificado funcionam por TLS-ALPN-01 na porta 443, então não há risco de expiração.
- Ruff e ESLint não fazem parte do workflow de CI, então erros de lint não bloqueiam merge.

## Resolvidos

- Ausência de caminho na interface para o administrador importar planilhas de
  clientes. Em 2026-10-14 a tela de Importações passou a ser exposta também em
  `/admin/importacoes`.
- Risco de bloqueio de acesso por falta de SMTP. Em 2026-10-14 ficou comprovado que a
  redefinição administrativa de senha funciona em produção, invalida sessões ativas e
  gera auditoria, servindo como caminho operacional até o e-mail ser configurado.
- Dependência de um usuário SDR para iniciar a prospecção. O administrador passou a
  cadastrar e disponibilizar leads pela própria tela; criar SDR ficou para uma fase futura.
- Identificação incorreta da infraestrutura. O endereço `179.197.72.43` foi confirmado
  pelo responsável como a VPS Hostinger correta.
- Em 2026-10-13, `funil.zhattiver.com` servia uma versão antiga identificada como “Lynk”.
  Resolvido pelo deploy de 2026-10-14, que publicou o commit `c7733f3`.
- Homologação de deploy e restauração de backup na VPS. Ambas executadas e aprovadas
  em 2026-10-14.
