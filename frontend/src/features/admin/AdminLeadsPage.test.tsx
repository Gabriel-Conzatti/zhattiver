import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminLeadsPage } from './AdminLeadsPage';

vi.mock('@/lib/api', () => ({
  leads: {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, per_page: 50, total: 0 }),
    create: vi.fn(),
    release: vi.fn(),
    archive: vi.fn(),
  },
  catalog: {
    origins: vi.fn().mockResolvedValue({ items: [] }),
    clientTypes: vi.fn().mockResolvedValue({ items: [] }),
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Seguro Auto', slug: 'auto', is_active: true }],
    }),
  },
}));

describe('AdminLeadsPage', () => {
  it('permite ao administrador cadastrar e disponibilizar leads', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminLeadsPage />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Novo lead' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cadastrar lead' })).toBeVisible();
    expect(await screen.findByRole('option', { name: 'Seguro Auto' })).toBeVisible();
  });
});
