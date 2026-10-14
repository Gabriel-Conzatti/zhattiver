# Problemas Conhecidos

- Identificadores técnicos `LYNK_*` permanecem por compatibilidade.
- Warnings de depreciação do backend de sessão filesystem aparecem apenas nos testes;
  produção usa Redis.
- SMTP ainda sem credencial em produção. DNS confirma Email Locaweb; a VPS alcança
  `email-ssl.com.br:587` por STARTTLS e o servidor exige `AUTH PLAIN/LOGIN`. O endpoint
  legado `smtp.locaweb.com.br` não responde. O configurador seguro
  `/root/configure-smtp.py` aguarda uma senha exclusiva da caixa remetente.
- `MonthlyGoal` e `BonusRule` não possuem nenhum registro em produção. Sem cadastro
  prévio, metas e apuração de bônus não produzem resultado.
- A base de produção tem apenas administrador e vendedor. Falta criar o usuário SDR
  para homologar o fluxo de prospecção.
- A porta 80 não responde externamente e o Caddy roda com `auto_https disable_redirects`.
  Quem digita o domínio sem `https://` não é redirecionado. A emissão e a renovação do
  certificado funcionam por TLS-ALPN-01 na porta 443, então não há risco de expiração.
- A produção não roda na VPS Hostinger descrita em `08 - Deploy/VPS Hostinger.md`, e sim
  em outro host, que também atende serviços não relacionados ao projeto. Avaliar migração
  para um host dedicado.
- Ruff e ESLint não fazem parte do workflow de CI, então erros de lint não bloqueiam merge.

## Resolvidos

- Em 2026-10-13, `funil.zhattiver.com` servia uma versão antiga identificada como “Lynk”.
  Resolvido pelo deploy de 2026-10-14, que publicou o commit `c7733f3`.
- Homologação de deploy e restauração de backup na VPS. Ambas executadas e aprovadas
  em 2026-10-14.
