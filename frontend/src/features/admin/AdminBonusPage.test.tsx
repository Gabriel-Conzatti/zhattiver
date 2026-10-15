import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminBonusPage } from './AdminBonusPage';

const { createGoal, createBonusRule } = vi.hoisted(() => ({
  createGoal: vi.fn(),
  createBonusRule: vi.fn(),
}));

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
  },
  catalog: {
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Seguro Auto', slug: 'auto', is_active: true }],
    }),
  },
  bonusApi: {
    adminList: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'payment-1',
          user_id: 'seller-1',
          product_id: 'product-1',
          year: 2026,
          month: 10,
          state: 'predicted',
          metric_base: 'net_premium',
          metric_value: '5000.00',
          amount: '500.00',
          predicted_on: '2026-11-20',
          paid_at: null,
          paid_amount: null,
        },
      ],
    }),
    refresh: vi.fn(),
    approve: vi.fn(),
    pay: vi.fn(),
    cancel: vi.fn(),
    goals: vi.fn().mockResolvedValue({ items: [] }),
    createGoal,
    bonusRules: vi.fn().mockResolvedValue({ items: [] }),
    createBonusRule,
    endBonusRule: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminBonusPage />
    </QueryClientProvider>,
  );
}

describe('AdminBonusPage', () => {
  beforeEach(() => {
    createGoal.mockReset();
    createBonusRule.mockReset();
  });

  it('exibe nomes de vendedor e produto na apuração', async () => {
    renderPage();

    expect(await screen.findByText('Vendedora Exemplo')).toBeVisible();
    expect(screen.getByText('Seguro Auto')).toBeVisible();
    expect(screen.getByText(/R\$\s*500,00/)).toBeVisible();
    expect(screen.queryByText('seller-1')).not.toBeInTheDocument();
  });

  it('salva uma meta mensal para vendedor e produto selecionados', async () => {
    createGoal.mockResolvedValue({ id: 'goal-1' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Metas mensais' }));
    await screen.findByRole('option', { name: 'Vendedora Exemplo' });
    fireEvent.change(screen.getByLabelText('Vendedor'), {
      target: { value: 'seller-1' },
    });
    fireEvent.change(screen.getByLabelText('Produto'), {
      target: { value: 'product-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade alvo'), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByLabelText('Prêmio líquido alvo'), {
      target: { value: '18000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar meta' }));

    await waitFor(() =>
      expect(createGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'seller-1',
          product_id: 'product-1',
          target_count: 12,
          target_net_premium: '18000',
        }),
      ),
    );
    expect(await screen.findByText('Meta salva com sucesso.')).toBeVisible();
  });

  it('publica faixa de bônus com vigência em competências mensais', async () => {
    createBonusRule.mockResolvedValue({ id: 'rule-1' });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Faixas de bônus' }));
    await screen.findByRole('option', { name: 'Seguro Auto' });
    fireEvent.change(screen.getByLabelText('Produto'), {
      target: { value: 'product-1' },
    });
    fireEvent.change(screen.getByLabelText('Nome da faixa'), {
      target: { value: 'Faixa ouro' },
    });
    fireEvent.change(screen.getByLabelText('Valor por negócio'), {
      target: { value: '500' },
    });
    fireEvent.change(screen.getByLabelText('Competência inicial'), {
      target: { value: '2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar faixa' }));

    await waitFor(() =>
      expect(createBonusRule).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 'product-1',
          name: 'Faixa ouro',
          value: '500',
          effective_from: '2026-11-01',
        }),
      ),
    );
    expect(await screen.findByText('Faixa publicada com sucesso.')).toBeVisible();
  });
});
