# Catálogos Administrativos

## Objetivo

Permitir que administradores mantenham as opções usadas nos fluxos comerciais sem
alterar código e sem apagar referências históricas.

## Catálogos

- Produtos.
- Origens.
- Tipos de cliente.
- Seguradoras.
- Categorias de tag.
- Tags e cores.

## Perfis autorizados

- Administrador para criar, editar, arquivar e restaurar.
- Demais perfis mantêm apenas leitura dos itens ativos usados em seus fluxos.

## Backend

A API consolidada `/api/v1/admin/catalogs` lista inclusive itens arquivados e
oferece criação e atualização por tipo.

## Frontend

A tela `/admin/configuracoes` oferece cards por catálogo, edição inline e ações de
arquivar/restaurar. O padrão visual segue os cards e formulários administrativos
existentes; não havia referência visual específica para catálogos no repositório.

## Segurança

- Organização sempre derivada da sessão.
- Mutações exclusivas de administrador.
- Categorias de tags precisam pertencer à organização ativa e estar disponíveis.
- Todas as mudanças geram auditoria.

## Preservação histórica

Não há exclusão pela interface. O arquivamento remove o item das listas operacionais,
mas o mantém disponível no histórico administrativo e permite restauração.

## Testes

- Autorização e isolamento multiempresa.
- Duplicidade e categoria externa.
- Arquivamento e restauração.
- Componente frontend e fluxo Playwright.

## Histórico

- 2026-10-13 - Gestão administrativa completa implementada.
