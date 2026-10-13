# ADR-001 - Identidade e compatibilidade técnica

## Status

Aceita

## Data

2026-10-13

## Contexto

O nome oficial é Funil Sustentare, mas instalações existentes dependem de
variáveis, cookies, comandos e chaves internas com o prefixo legado.

## Decisão

Alterar imediatamente todas as superfícies visíveis para Funil Sustentare e
preservar identificadores técnicos legados até uma migração versionada.

## Consequências positivas

- Identidade correta para usuários.
- Nenhuma quebra de deploy ou sessão por renomeação interna abrupta.

## Consequências negativas

- O prefixo técnico legado permanece temporariamente no código operacional.

