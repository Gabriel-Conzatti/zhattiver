import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SinistrosPage } from './SinistrosPage';

const useAuth = vi.fn();

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/lib/api', () => ({
  claims: {
    statuses: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'status-1',
          name: 'Em acompanhamento',
          slug: 'em_acompanhamento',
          sort_order: 0,
          is_terminal: false,
        },
      ],
    }),
    assignees: vi.fn().mockResolvedValue({ users: [], teams: [] }),
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      per_page: 20,
      total: 0,
    }),
    get: vi.fn(),
    create: vi.fn(),
    changeStatus: vi.fn(),
    assign: vi.fn(),
    addEvent: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    archive: vi.fn(),
  },
}));

function renderPage(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SinistrosPage readOnly={readOnly} />
    </QueryClientProvider>,
  );
}

describe('SinistrosPage', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: {
        id: 'user-1',
        role: 'admin',
        grants: [],
      },
    });
  });

  it('exibe os filtros e o estado vazio', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Sinistros' })).toBeVisible();
    expect(screen.getByLabelText('Buscar sinistros')).toBeVisible();
    expect(screen.getByLabelText('Filtrar por status')).toBeVisible();
    expect(await screen.findByText('Nenhum sinistro encontrado para os filtros atuais.')).toBeVisible();
  });

  it('oculta ações de escrita no modo de consulta', async () => {
    renderPage(true);

    expect(screen.queryByRole('button', { name: /Novo sinistro/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhum sinistro encontrado para os filtros atuais.')).toBeVisible();
  });
});
