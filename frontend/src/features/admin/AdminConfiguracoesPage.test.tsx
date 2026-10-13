import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminConfiguracoesPage } from './AdminConfiguracoesPage';

const { createFunnel } = vi.hoisted(() => ({ createFunnel: vi.fn() }));

vi.mock('@/lib/api', () => ({
  admin: {
    funnels: vi.fn().mockResolvedValue({ items: [] }),
    lossReasons: vi.fn().mockResolvedValue({ items: [] }),
    nextActionTypes: vi.fn().mockResolvedValue({ items: [] }),
    createFunnel,
    updateFunnel: vi.fn(),
    createFunnelStage: vi.fn(),
    updateFunnelStage: vi.fn(),
    createLossReason: vi.fn(),
    updateLossReason: vi.fn(),
    createNextActionType: vi.fn(),
    updateNextActionType: vi.fn(),
  },
  catalog: {
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Seguro Auto', slug: 'auto', is_active: true }],
    }),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminConfiguracoesPage />
    </QueryClientProvider>,
  );
}

describe('AdminConfiguracoesPage', () => {
  afterEach(() => {
    createFunnel.mockReset();
  });

  it('exibe estados vazios e cria um funil com produto selecionado', async () => {
    createFunnel.mockResolvedValue({ id: 'funnel-1' });
    renderPage();

    expect(await screen.findByText('Nenhum funil configurado. Crie o primeiro acima.')).toBeVisible();
    expect(screen.getAllByText('Nenhuma opção configurada.')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Nome do novo funil'), {
      target: { value: 'Renovação' },
    });
    fireEvent.change(screen.getByLabelText('Produto'), {
      target: { value: 'product-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar funil' }));

    await waitFor(() =>
      expect(createFunnel).toHaveBeenCalledWith({
        name: 'Renovação',
        product_id: 'product-1',
        is_default: false,
      }),
    );
    expect(await screen.findByText('Funil criado.')).toBeVisible();
  });
});
