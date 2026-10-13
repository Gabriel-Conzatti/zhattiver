# Configurações administrativas

## Objetivo

Permitir que administradores mantenham configurações comerciais sem alterar código ou
depender de novo seed da aplicação.

## Perfis autorizados

- Administrador: consulta e alteração.
- Vendedor e SDR: não acessam a tela nem as mutações administrativas.
- Vendedor e SDR continuam consultando somente os catálogos ativos necessários aos seus
  fluxos.

## Funis, etapas e mensagens

- Cada funil pertence a um produto da mesma organização.
- Um funil pode ser marcado como padrão; ao fazer isso, os demais funis ativos daquele
  produto deixam de ser padrão.
- Etapas possuem nome, ordem, indicação inicial/final e mensagem opcional.
- Ao marcar uma etapa como inicial, as demais etapas ativas do funil deixam de ser iniciais.
- Mensagens aceitam `{nome_cliente}`, `{nome_vendedor}` e `{nome_indicador}`. Variáveis sem
  valor usam o fallback já definido pelo renderizador.
- Arquivamento preserva registros e relacionamentos históricos.

## Catálogos comerciais

- Motivos de perda e tipos de próxima ação podem ser criados, desativados e reativados.
- Opções desativadas permanecem no histórico e deixam de aparecer nos fluxos operacionais.
- Nomes duplicados dentro da mesma organização são rejeitados.

## Segurança e auditoria

- O backend deriva a organização exclusivamente da sessão.
- Produto, funil, etapa e item de catálogo de outra organização são rejeitados.
- Criações e alterações geram `AuditLog` na mesma transação.
- Não há exclusão física pela interface.

## Interface

A tela fica disponível em **Administração > Configurações** e apresenta estados de
carregamento, vazio, erro, sucesso e indisponibilidade operacional para funis sem etapas.
Não havia arquivo visual de referência no repositório; a tela segue os componentes, cores,
cards, tipografia e navegação já usados nas páginas administrativas existentes.

## Testes

- Integração backend cobre negação para vendedor, produto externo, isolamento de funil,
  criação/ordenação de etapas, unicidade da etapa inicial e ativação de catálogos.
- Componente frontend cobre os estados vazios e a criação de funil com produto.
