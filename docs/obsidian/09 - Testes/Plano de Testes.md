# Plano de Testes

## Barreiras

- Backend: pytest contra SQLite local e PostgreSQL 16 na CI.
- Frontend: TypeScript, ESLint, Vitest e build.
- E2E: Playwright com PostgreSQL 16, Redis 7 e Chromium.
- Infraestrutura: validação de Compose de produção e desenvolvimento.

## Fluxos E2E atuais

- Identidade oficial.
- Login, logout e credencial inválida.
- Cadastro, duplicidade e disponibilização de lead pelo SDR.
- Primeiro contato e metas do vendedor.
- Validação administrativa de venda e conferência do relatório financeiro.
- Criação e arquivamento administrativo de produto.
- Navegação móvel administrativa sem conteúdo cortado.
- Ação contextual de nova venda disponível somente ao vendedor.
- Ausência de controles inertes no perfil SDR.
- Logout permanece efetivo após recarregar a página.
- Administração de metas mensais e faixas de bônus.
- Rejeição de referências externas, faixas sobrepostas e vigência retroativa.
- Cancelamento de bônus previsto com justificativa e auditoria.
