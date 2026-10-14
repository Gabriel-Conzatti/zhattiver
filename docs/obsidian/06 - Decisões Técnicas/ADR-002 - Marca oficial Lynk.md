# ADR-002 - Marca oficial Lynk

## Status

Aceita

## Data

2026-10-14

## Contexto

A ADR-001 definiu "Funil Sustentare" como identidade visível e tratou o prefixo
técnico `LYNK_*` como legado a ser migrado.

Ao receber o logotipo oficial do produto, verificou-se que a marca desenhada é
**Lynk**, acompanhada do descritor "Funil de Vendas". O responsável pelo projeto
confirmou que a marca correta é Lynk. Manter "Funil Sustentare" criaria
divergência entre o logotipo exibido e os textos ao redor dele.

## Decisão

Adotar **Lynk** como nome oficial e visível do produto.

- Atualizar título, descrição, favicon, login, cabeçalho e navegação
  administrativa.
- Manter os identificadores técnicos `LYNK_*` e o comando `flask lynk`, que
  deixam de ser legados e passam a estar alinhados à marca.
- Preservar o histórico já registrado no Changelog e no Diário, sem reescrever
  entradas antigas.
- Gerar o favicon a partir do símbolo do próprio logotipo.

## Alternativas consideradas

- Manter "Funil Sustentare" e substituir o logotipo: rejeitada, pois o logotipo
  foi fornecido como material oficial.
- Usar "Funil Sustentare" como nome e "Lynk" apenas como logotipo: rejeitada,
  por gerar marca dupla na mesma tela.

## Consequências positivas

- Textos e logotipo passam a comunicar a mesma marca.
- Elimina a dívida de renomear as variáveis `LYNK_*`, cookies e comandos.
- Favicon derivado do logotipo, sem ícone genérico.

## Consequências negativas

- Documentos históricos continuam citando o nome anterior, por decisão de não
  reescrever histórico.
- Usuários que já conheciam o sistema pelo nome anterior precisam da mudança
  comunicada.

## Impacto na implementação

Frontend: `index.html`, `LoginPage.tsx`, `TopBar.tsx`, `AdminLayout.tsx`,
`tailwind.config.js`, `public/favicon.svg`.
Backend: `app/cli/__init__.py`, `app/modules/auth/password_recovery.py`.
Testes: `LoginPage.test.tsx` e `e2e/login.spec.ts`.
