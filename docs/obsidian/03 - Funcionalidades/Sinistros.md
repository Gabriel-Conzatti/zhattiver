# Sinistros

## Objetivo

Acompanhar sinistros no mesmo ambiente do Funil Sustentare, com registro de seguradora, ramo, atendimento, terceiros, oficina, prazos, indenização, observações, tarefas e histórico.

## Escopo inicial

- Equipe com `claims.manage` cadastra e opera os registros.
- Administrador possui acesso administrativo.
- Vendedor consulta somente sinistros vinculados a leads/operações que já pode visualizar.
- Usuário com `claims.read` consulta o módulo sem ações de escrita.
- O vínculo com lead, oportunidade ou venda é opcional.
- A primeira versão inicia novos sinistros; a planilha histórica não é importada.

## Estados

Os estados padrão são configurados por organização: Em acompanhamento, Verificar, Aguardando seguradora, Aguardando terceiro, Concluído e Finalizado.

## Segurança

O backend deriva a organização da sessão, aplica autorização por perfil/concessão e grava
eventos e auditoria em transação. A atribuição isolada não concede acesso comercial ao
vendedor. Valores de indenização exigem administrador, `claims.manage` ou
`claims.view_financial`. Não são registrados dados pessoais da planilha na documentação.

## Backend

- API paginada com busca, status, responsável, seguradora e filtro de atraso.
- Atribuição de responsável/equipe, timeline, participantes, tarefas e arquivamento.
- Registros comerciais são arquivados, não excluídos.

## Frontend

- Tela administrativa com cadastro, filtros, paginação, detalhe e ações operacionais.
- Vendedor possui consulta limitada ao próprio escopo comercial.
- SDR visualiza o menu somente quando possui `claims.read` ou `claims.manage`.

## Banco de dados

- Tabelas para sinistro, estados, participantes, eventos, tarefas e metadados de documentos.
- Arquivos binários não fazem parte da V1; storage privado será definido antes do upload.

## Testes necessários

- Autorização e isolamento entre organizações.
- Visibilidade financeira e escopo comercial do vendedor.
- Fluxos de atribuição, status, tarefas, arquivamento, filtros e paginação.
- Ciclo de migration em PostgreSQL validado; aplicar upgrade com backup no deploy.

## Histórico

- 2026-10-16 — implementação local concluída para novos sinistros; deploy ainda pendente.
