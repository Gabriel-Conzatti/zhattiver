import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminDashboard } from './AdminDashboard';

const apiMocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  admin: { dashboard: apiMocks.dashboard },
}));

describe('AdminDashboard', () => {
  beforeEach(() => {
    apiMocks.dashboard.mockReset();
  });

  it('exibe somente indicadores retornados pela API', async () => {
    apiMocks.dashboard.mockResolvedValue({
      leads_total: 42,
      open_opportunities: 7,
      pending_sales: 3,
      active_schedules: 5,
      active_users: 2,
    });

    renderDashboard();

    expect(await screen.findByText('42')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByText('693')).not.toBeInTheDocument();
    expect(screen.queryByText(/Renan Santos/i)).not.toBeInTheDocument();
  });

  it('informa falha sem substituir os dados por números arbitrários', async () => {
    apiMocks.dashboard.mockRejectedValue(new Error('indisponível'));

    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os indicadores administrativos.',
    );
    expect(screen.getAllByText('—')).toHaveLength(5);
  });
});

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
