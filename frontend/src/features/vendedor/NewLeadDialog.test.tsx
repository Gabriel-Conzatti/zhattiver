import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { NewLeadDialog } from './NewLeadDialog';

const apiMocks = vi.hoisted(() => ({
  createDirectLead: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  catalog: {
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Seguro Auto', slug: 'auto', is_active: true }],
    }),
  },
  opportunities: {
    createDirectLead: apiMocks.createDirectLead,
  },
}));

function renderDialog(onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <NewLeadDialog onClose={vi.fn()} onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return onSuccess;
}

describe('NewLeadDialog', () => {
  it('cria o lead diretamente no produto selecionado', async () => {
    apiMocks.createDirectLead.mockResolvedValue({
      lead: { id: 'lead-1', name: 'Cliente Novo' },
      opportunity: { id: 'opp-1' },
    });
    const onSuccess = renderDialog();

    await screen.findByRole('option', { name: 'Seguro Auto' });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Cliente Novo' } });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(51) 99999-1234' },
    });
    fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'Porto Alegre' } });
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'rs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar no funil' }));

    await waitFor(() =>
      expect(apiMocks.createDirectLead).toHaveBeenCalledWith({
        name: 'Cliente Novo',
        phone: '(51) 99999-1234',
        product_id: 'product-1',
        city: 'Porto Alegre',
        state: 'RS',
      }),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
