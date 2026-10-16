# Sinistros

## Objetivo

Acompanhar sinistros no mesmo ambiente do Funil Sustentare, com registro de seguradora, ramo, atendimento, terceiros, oficina, prazos, indenização, observações, tarefas e histórico.

## Escopo inicial

- Equipe com `claims.manage` cadastra e opera os registros.
- Administrador possui acesso administrativo.
- Vendedor sem concessão não acessa o módulo. Com `claims.read`, consulta somente
  sinistros vinculados a leads/operações que já pode visualizar; com `claims.manage`,
  acumula a função comercial e a operação de sinistros.
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
- Ramos iniciais: Auto, RE e RCO ONIBUS.
- Seguradoras iniciais: Allianz, Azul, Bradesco, HDI, Porto, Sura, Tokio, Yelum, Zurich,
  Aliro, ESSOR/LIVONIUS, EZZE, Mapfre e Suhai.
- Oficinas registram nome, telefone, endereço, responsável e seguradoras referenciadoras.
  Uma oficina só pode ser usada com seguradora vinculada.
- Registros comerciais são arquivados, não excluídos.

## Frontend

- Tela administrativa com cadastro, filtros, paginação, detalhe e ações operacionais.
- Botão **Oficinas** permite cadastrar e arquivar oficinas referenciadas.
- Cadastro de sinistro usa seletores de ramo, seguradora e oficina compatível.
- Vendedor só vê o menu quando possui `claims.read` ou `claims.manage`.
- SDR visualiza o menu somente quando possui `claims.read` ou `claims.manage`.

## Como designar a equipe de sinistros

O administrador abre **Administração → Usuários**, cria ou edita o usuário e escolhe os
**Perfis**. Vendedor, SDR e Administrador são perfis comerciais mutuamente exclusivos;
**Sinistros** pode ser selecionado junto de Vendedor ou SDR:

| Opção | Permissão concedida | O que o usuário faz |
| --- | --- | --- |
| Sinistros desmarcado | nenhuma | não enxerga o módulo |
| Consulta | `claims.read` | acompanha os registros sem escrever |
| Operação | `claims.manage` | cadastra, atribui, movimenta e conclui |

O campo grava concessões em `permission_grants`, com auditoria do ator e dos valores anterior
e novo. Rebaixar um nível revoga a concessão anterior em vez de apagá-la. O perfil
`admin` sempre opera sinistros, por isso o campo aparece bloqueado em **Operação** e o backend
rejeita restringi-lo com `invalid_claims_access` (422). As mesmas permissões continuam
disponíveis em **Administração → Concessões** para vigências temporárias.

## Banco de dados

- Tabelas para sinistro, estados, participantes, eventos, tarefas e metadados de documentos.
- Arquivos binários não fazem parte da V1; storage privado será definido antes do upload.

## Testes necessários

- Autorização e isolamento entre organizações.
- Visibilidade financeira e escopo comercial do vendedor.
- Fluxos de atribuição, status, tarefas, arquivamento, filtros e paginação.
- Ciclo de migration em PostgreSQL validado; aplicar upgrade com backup no deploy.

## Histórico

- 2026-10-16 — implementação local concluída para novos sinistros.
- 2026-10-15 — catálogos de ramo e seguradora e cadastro de oficinas publicados com o
  commit `96d6376`; migration `b4c91e8d2f60` aplicada em produção.
- 2026-10-15 — publicado em produção com o commit `33ecab3`; migration `7d2f4c8a91be`
  aplicada e seis estados padrão semeados na organização existente.
