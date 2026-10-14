# Identidade do Produto

## Objetivo

Apresentar o sistema oficialmente como **Lynk**.

## Superfícies

- Login.
- Cabeçalho do vendedor e SDR.
- Navegação administrativa.
- Título do navegador, descrição e favicon.
- Documentação principal.

## Marca

O logotipo oficial é `frontend/public/logo-lynk.svg`, com a marca denominativa
"Lynk" e o descritor "Funil de Vendas". O favicon
(`frontend/public/favicon.svg`) reaproveita apenas o símbolo (o arco) do
logotipo, sobre o fundo `#050B1F`, com os tons claros do gradiente
(`#00CBFF` → `#0079FF`) para manter legibilidade em 16px.

## Compatibilidade

Identificadores técnicos com o prefixo `LYNK_*` e o comando `flask lynk`
continuam válidos e agora estão alinhados à marca visível.

## Testes

O Playwright verifica o título e o nome oficial na autenticação e após login
administrativo.
