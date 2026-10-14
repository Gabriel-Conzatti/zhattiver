# Frontend

- React 18 e TypeScript.
- Vite e Tailwind CSS.
- TanStack Query, React Hook Form e Zod.
- Playwright para fluxos críticos e Vitest para componentes.

Identidade visível: **Lynk**.

## Navegação e responsividade

- Cabeçalho de vendedor e SDR usa navegação horizontal contida no viewport.
- Ações globais só aparecem quando possuem comportamento disponível para o perfil.
- Administração usa sidebar em desktop e menu lateral modal em telas pequenas.
- Tabelas permanecem roláveis dentro do próprio card, sem criar rolagem horizontal na página.
- Requisições autenticadas usam `cache: no-store`; React Query é a única camada de cache
  do frontend.

## Painéis por perfil

- Vendedor, SDR e administrador compartilham componentes visuais de métricas,
  atalhos e estados de painel em `frontend/src/components/DashboardUi.tsx`.
- O padrão visual é compartilhado, mas cada perfil mantém seus próprios contratos
  de API, rotas e limites de autorização.
- A navegação lateral do administrador permanece separada da navegação horizontal
  de vendedor e SDR para acomodar a quantidade de módulos sem alterar as rotas.
- Dashboards nunca usam amostras, valores arbitrários ou dados dos prints como
  fallback. Carregamento, vazio e erro são apresentados explicitamente.
