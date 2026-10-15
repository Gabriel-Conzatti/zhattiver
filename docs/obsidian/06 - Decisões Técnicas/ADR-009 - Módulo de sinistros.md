# ADR-009 - Módulo de sinistros

## Status

Aceita

## Contexto

A operação acompanha sinistros em uma planilha com abas operacionais, mensais e de finalizados. O formato não possui um status único consistente e mistura valores monetários e datas em formatos diferentes.

## Decisão

Criar um módulo `claims` separado no monólito modular existente. A planilha orienta os
campos e estados, mas não será copiada para o modelo relacional nem importada na primeira
entrega. O módulo terá isolamento por organização, autorização centralizada, histórico de
eventos e vínculo comercial opcional.

Administrador e `claims.manage` operam o módulo; `claims.read` permite consulta. O
vendedor consulta somente sinistros vinculados a lead, oportunidade ou venda do próprio
escopo, e a atribuição como responsável não amplia esse acesso. A indenização exige
administrador, `claims.manage` ou `claims.view_financial`.

Documentos terão apenas metadados no banco até existir storage privado com autorização,
URLs temporárias, política de retenção e auditoria. A importação histórica será uma fase
separada com prévia, normalização, detecção de duplicidades, idempotência e rollback.

## Consequências

- Reutiliza autenticação, auditoria, infraestrutura e identidade visual.
- Permite evoluir o fluxo sem acoplar sinistro a oportunidade ou venda.
- A importação histórica exigirá uma fase própria de normalização e revisão.
- Upload de documentos fica indisponível até a infraestrutura privada ser definida.
