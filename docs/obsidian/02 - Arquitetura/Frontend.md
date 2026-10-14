# Frontend

- React 18 e TypeScript.
- Vite e Tailwind CSS.
- TanStack Query, React Hook Form e Zod.
- Playwright para fluxos críticos e Vitest para componentes.

Identidade visível: **Funil Sustentare**.

## Navegação e responsividade

- Cabeçalho de vendedor e SDR usa navegação horizontal contida no viewport.
- Ações globais só aparecem quando possuem comportamento disponível para o perfil.
- Administração usa sidebar em desktop e menu lateral modal em telas pequenas.
- Tabelas permanecem roláveis dentro do próprio card, sem criar rolagem horizontal na página.
- Requisições autenticadas usam `cache: no-store`; React Query é a única camada de cache
  do frontend.
