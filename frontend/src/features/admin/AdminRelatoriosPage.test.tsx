import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminRelatoriosPage } from './AdminRelatoriosPage';

vi.mock('@/lib/api', () => ({
  admin: {
    users: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'seller-1',
          name: 'Vendedora Exemplo',
          email: 'seller@example.com',
          role: 'vendedor',
          is_active: true,
          last_login_at: null,
          product_ids: ['product-1'],
        },
      ],
    }),
    productionReport: vi.fn().mockResolvedValue({
      year: 2026,
      month: 10,
      filters: { seller_user_id: null, product_id: null },
      state_counts: { registered: 2, revision_pending: 1, validated: 3, cancelled: 1 },
      totals: {
        validated_count: 3,
        net_premium: '4500.00',
        commission_amount: '675.00',
      },
      items: [
        {
          seller_user_id: 'seller-1',
          seller_name: 'Vendedora Exemplo',
          product_id: 'product-1',
          product_name: 'Seguro Auto',
          validated_count: 3,
          net_premium: '4500.00',
          commission_amount: '675.00',
        },
      ],
    }),
  },
  catalog: {
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Seguro Auto', slug: 'auto', is_active: true }],
    }),
  },
}));

describe('AdminRelatoriosPage', () => {
  it('exibe produção validada e valores financeiros agregados', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminRelatoriosPage />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText('Vendedora Exemplo')).toHaveLength(2);
    expect(screen.getAllByText('Seguro Auto')).toHaveLength(2);
    expect(screen.getAllByText(/R\$\s*4\.500,00/)).toHaveLength(2);
    expect(screen.getAllByText(/R\$\s*675,00/)).toHaveLength(2);
    expect(screen.getByText('Em revisão')).toBeVisible();
  });
});
