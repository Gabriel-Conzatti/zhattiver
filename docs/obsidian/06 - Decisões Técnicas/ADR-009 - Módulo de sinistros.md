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

Administrador e `claims.manage` operam o módulo; `claims.read` permite consulta. Perfis
comerciais não recebem acesso implícito: a função de sinistros é anexada como concessão,
permitindo combinações como vendedor + operação de sinistros sem criar papéis compostos.
Quando a pessoa não exerce função comercial, o perfil-base `sinistros` é usado junto de
`claims.read` ou `claims.manage`. Esse perfil possui allowlist central: autenticação,
perfil pessoal, notificações e `/claims`; as demais APIs retornam `403`.
Quando um vendedor recebe apenas `claims.read`, a consulta permanece limitada a lead,
oportunidade ou venda do próprio escopo. A indenização exige administrador,
`claims.manage` ou `claims.view_financial`.

Ramos e seguradoras são catálogos normalizados por organização. O sinistro referencia os
IDs e preserva os nomes como fotografia histórica. Oficinas possuem cadastro próprio e
relação N:N com seguradoras; o backend rejeita vincular uma oficina a sinistro de
seguradora que não a referencia.

Documentos terão apenas metadados no banco até existir storage privado com autorização,
URLs temporárias, política de retenção e auditoria. A importação histórica será uma fase
separada com prévia, normalização, detecção de duplicidades, idempotência e rollback.

## Consequências

- Reutiliza autenticação, auditoria, infraestrutura e identidade visual.
- Permite evoluir o fluxo sem acoplar sinistro a oportunidade ou venda.
- Permite acumular funções ou isolar a equipe exclusiva de sinistros, mantendo negação por
  padrão.
- Evita texto livre em ramo, seguradora e oficina sem perder o histórico existente.
- A importação histórica exigirá uma fase própria de normalização e revisão.
- Upload de documentos fica indisponível até a infraestrutura privada ser definida.
