import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminCatalogsSection } from './AdminCatalogsSection';

const { createCatalogItem, updateCatalogItem } = vi.hoisted(() => ({
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  admin: {
    createCatalogItem,
    updateCatalogItem,
  },
}));

describe('AdminCatalogsSection', () => {
  it('cria produto e arquiva item sem excluí-lo', async () => {
    createCatalogItem.mockResolvedValue({ id: 'new', name: 'Novo', archived: false });
    updateCatalogItem.mockResolvedValue({ id: 'product-1', name: 'Auto', archived: true });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminCatalogsSection
          loading={false}
          catalogs={{
            products: [{ id: 'product-1', name: 'Auto', archived: false }],
            origins: [],
            client_types: [],
            insurers: [],
            tag_categories: [],
            tags: [],
          }}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Novo item em Produtos'), {
      target: { value: 'Residencial' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar' })[0]);
    await waitFor(() =>
      expect(createCatalogItem).toHaveBeenCalledWith('products', { name: 'Residencial' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    await waitFor(() =>
      expect(updateCatalogItem).toHaveBeenCalledWith('products', 'product-1', {
        archived: true,
      }),
    );
  });
});
