import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminUsuariosPage } from './AdminUsuariosPage';

const { updateUser } = vi.hoisted(() => ({
  updateUser: vi.fn(),
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
          daily_prospecting_quota: null,
          quota_effective_from: null,
          claims_access: 'none',
        },
      ],
    }),
    createUser: vi.fn(),
    updateUser,
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
      <AdminUsuariosPage />
    </QueryClientProvider>,
  );
}

describe('AdminUsuariosPage', () => {
  beforeEach(() => {
    updateUser.mockReset();
    updateUser.mockResolvedValue({});
  });

  it('configura meta diária de prospecção com vigência', async () => {
    renderPage();

    expect(await screen.findByText('Vendedora Exemplo')).toBeVisible();
    expect(screen.getByText('Não definida')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Nova meta diária de prospecção' }),
      {
      target: { value: '15' },
      },
    );
    fireEvent.change(screen.getByLabelText('Vigência da nova meta'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(
        'seller-1',
        expect.objectContaining({
          daily_prospecting_quota: 15,
          quota_effective_from: '2026-10-15',
        }),
      ),
    );
  });

  it('designa o usuário para operar sinistros', async () => {
    renderPage();

    expect(await screen.findByText('Vendedora Exemplo')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Acesso a sinistros'), {
      target: { value: 'manage' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith(
        'seller-1',
        expect.objectContaining({ claims_access: 'manage' }),
      ),
    );
  });
});
