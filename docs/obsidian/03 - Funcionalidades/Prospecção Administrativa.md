# Prospecção Administrativa

## Objetivo

Permitir que a operação comece sem depender da criação de um usuário SDR.

## Perfis autorizados

- Administrador: cadastra, consulta, disponibiliza e arquiva leads.
- SDR: mantém o mesmo fluxo em sua área específica quando o perfil for adotado.
- Vendedor: trabalha somente os leads disponibilizados para seus produtos autorizados.

## Fluxo principal

1. O administrador abre **Comercial > Prospecção**.
2. Cadastra o lead com ao menos nome e telefone.
3. Seleciona um produto e disponibiliza o lead.
4. O vendedor autorizado encontra o item em sua Prospecção.

## Meta diária

A meta diária de prospecção é configurada em **Gestão > Equipe > Editar vendedor**.
Cada alteração informa uma data inicial, encerra a vigência anterior no dia anterior e
preserva o histórico. O valor zero desativa a exigência sem apagar registros.

## Segurança e auditoria

- A organização é derivada da sessão.
- Somente administrador e SDR criam/disponibilizam leads.
- Somente administrador altera a meta diária.
- Cadastro, disponibilização e alteração de meta geram auditoria.

## Histórico

- 2026-10-14 - Prospecção administrativa e gestão da meta diária adicionadas.
