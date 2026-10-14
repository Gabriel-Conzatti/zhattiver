import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportacoesPage } from './ImportacoesPage';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  importsApi: {
    list: apiMocks.list,
    get: apiMocks.get,
    upload: apiMocks.upload,
    confirm: apiMocks.confirm,
  },
}));

describe('ImportacoesPage', () => {
  beforeEach(() => {
    apiMocks.list.mockReset();
    apiMocks.get.mockReset();
    apiMocks.upload.mockReset();
    apiMocks.confirm.mockReset();
  });

  it('mostra estado vazio quando não há lotes', async () => {
    apiMocks.list.mockResolvedValue({ items: [] });

    renderPage();

    expect(await screen.findByText('Nenhum lote ainda.')).toBeVisible();
    expect(screen.getByText('Selecione um lote para ver detalhes.')).toBeVisible();
  });

  it('envia a planilha selecionada e sinaliza o lote recebido', async () => {
    apiMocks.list.mockResolvedValue({ items: [] });
    apiMocks.upload.mockResolvedValue({ id: 'lote-1' });
    apiMocks.get.mockResolvedValue({
      id: 'lote-1',
      type: 'leads',
      status: 'reviewing',
      filename: 'clientes.csv',
      rows_total: 1,
      rows_ok: 1,
      rows_error: 0,
      rows_duplicate: 0,
      created_at: '2026-01-05T12:00:00Z',
      rows: [
        {
          id: 'linha-1',
          line_no: 1,
          status: 'ok',
          errors: [],
          payload: { nome: 'Cliente Exemplo', telefone: '(00) 00000-0000' },
        },
      ],
    });

    renderPage();

    const file = new File(['nome,telefone\nCliente Exemplo,0000000000'], 'clientes.csv', {
      type: 'text/csv',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText(/Lote lote-1 recebido/i)).toBeVisible();
    expect(apiMocks.upload).toHaveBeenCalledWith(file);
    expect(await screen.findByText('Cliente Exemplo')).toBeVisible();
  });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ImportacoesPage />
    </QueryClientProvider>,
  );
}
