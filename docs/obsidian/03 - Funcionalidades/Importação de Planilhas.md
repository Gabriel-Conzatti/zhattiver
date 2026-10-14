# Importação de Planilhas de Clientes

## Objetivo

Permitir que a operação carregue listas de clientes em lote, a partir de planilha,
em vez de cadastrar lead por lead na tela de Prospecção.

## Regras de negócio

- Formatos aceitos: CSV e XLSX, até 8 MiB e 5.000 linhas por lote.
- Cabeçalho mínimo obrigatório: `nome` e `telefone`.
- Duplicidades são detectadas dentro do próprio lote e contra os leads já cadastrados.
- O lote nasce em revisão. Nenhum lead é criado antes da confirmação explícita.
- Ao confirmar, somente as linhas com status `ok` viram leads.
- O lote pertence à organização derivada da sessão. O cliente nunca informa a organização.

## Perfis autorizados

- Administrador
- SDR

O backend valida os dois perfis em `_require_sdr_or_admin`. Como a operação entrou em
produção sem usuário SDR, o administrador precisa de caminho próprio na interface.

## Fluxo principal

1. Acessar **Importações** no menu (`/admin/importacoes` ou `/sdr/importacoes`).
2. Selecionar o arquivo. O upload cria o lote com status `reviewing`.
3. Revisar a tabela linha a linha: OK, duplicado, erro ou ignorado.
4. Confirmar as linhas OK. O retorno informa quantos leads foram criados e quantas
   pendências restaram.

## Validações

- Extensão e tamanho do arquivo.
- Presença das colunas obrigatórias.
- Normalização de telefone e detecção de duplicidade.
- Limite de linhas por lote.

## Backend

`backend/app/modules/imports/` — `routes.py`, `parser.py` e `models.py`
(`ImportBatch` e `ImportRow`).

## Frontend

`frontend/src/features/imports/ImportacoesPage.tsx` — tela única compartilhada pelas
rotas de administrador e de SDR. O arquivo veio de `features/sdr/SdrImportacoesPage.tsx`
e foi movido para um módulo neutro justamente para evitar duplicação de código entre
os dois perfis.

Pontos de entrada no admin:

- Menu lateral, grupo **Comercial** > Importações.
- Atalho **Importações** no painel administrativo.

## API

- `GET /api/v1/imports` — últimos 50 lotes da organização.
- `GET /api/v1/imports/{id}` — detalhe com as linhas.
- `POST /api/v1/imports` — upload multipart com `X-CSRF-Token`.
- `POST /api/v1/imports/{id}/confirm` — cria os leads das linhas OK.

## Segurança

- Autorização verificada no backend por perfil, com negação por padrão.
- `organization_id` derivado sempre da sessão.
- Confirmação e upload registram auditoria.

## Testes necessários

- Componente: estado vazio e envio de arquivo com exibição das linhas do lote
  (`frontend/src/features/imports/ImportacoesPage.test.tsx`).
- Integração backend: já coberta pelos testes do módulo `imports`.

## Histórico

- 2026-10-14 - Tela disponibilizada também para o administrador em `/admin/importacoes`.
