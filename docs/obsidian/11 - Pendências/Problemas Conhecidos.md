# Problemas Conhecidos

- Identificadores técnicos `LYNK_*` permanecem por compatibilidade.
- Metas e faixas de bônus ainda não possuem UI administrativa completa.
- Homologação e restauração de backup na VPS ainda dependem do ambiente externo.
- Warnings de depreciação do backend de sessão filesystem aparecem apenas nos testes;
  produção usa Redis.
- Em 2026-10-13, `funil.zhattiver.com` ainda servia uma versão antiga identificada como
  “Lynk”. O deploy da `main` atualizada na VPS permanece obrigatório para publicar as
  correções já integradas.
