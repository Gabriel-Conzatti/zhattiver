import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SdrDashboard } from './SdrDashboard';

const apiMocks = vi.hoisted(() => ({
  listLeads: vi.fn(),
  listImports: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  leads: { list: apiMocks.listLeads },
  importsApi: { list: apiMocks.listImports },
}));

describe('SdrDashboard', () => {
  beforeEach(() => {
    apiMocks.listLeads.mockReset();
    apiMocks.listImports.mockReset();
  });

  it('usa o resumo real de leads e da última importação', async () => {
    apiMocks.listLeads.mockResolvedValue({ items: [], page: 1, per_page: 1, total: 12 });
    apiMocks.listImports.mockResolvedValue({
      items: [{
        id: 'import-1',
        type: 'leads',
        status: 'confirmed',
        filename: 'clientes.csv',
        rows_total: 20,
        rows_ok: 17,
        rows_error: 0,
        rows_duplicate: 3,
        created_at: '2026-10-14T12:00:00Z',
      }],
    });

    renderDashboard();

    expect(await screen.findByText('12')).toBeVisible();
    expect(screen.getByText('clientes.csv')).toBeVisible();
    expect(screen.getByText('Confirmada')).toBeVisible();
    expect(screen.queryByText(/Renan Santos/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Setembro 2026')).not.toBeInTheDocument();
  });

  it('mostra indisponibilidade quando as APIs falham', async () => {
    apiMocks.listLeads.mockRejectedValue(new Error('indisponível'));
    apiMocks.listImports.mockRejectedValue(new Error('indisponível'));

    renderDashboard();

    expect(await screen.findByText('Não foi possível carregar o resumo da prospecção.')).toBeVisible();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SdrDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
