import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportacoesPage } from './ImportacoesPage';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  confirm: vi.fn(),
  discard: vi.fn(),
  requestDeletion: vi.fn(),
  deletionRequests: vi.fn(),
  reviewDeletion: vi.fn(),
  role: 'sdr',
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: apiMocks.role, grants: [] } }),
}));

vi.mock('@/lib/api', () => ({
  importsApi: {
    list: apiMocks.list,
    get: apiMocks.get,
    upload: apiMocks.upload,
    confirm: apiMocks.confirm,
    discard: apiMocks.discard,
  },
  leads: {
    requestDeletion: apiMocks.requestDeletion,
    deletionRequests: apiMocks.deletionRequests,
    reviewDeletion: apiMocks.reviewDeletion,
  },
}));

const batch = {
  id: 'lote-1',
  type: 'leads',
  filename: 'clientes.csv',
  rows_total: 1,
  rows_ok: 1,
  rows_error: 0,
  rows_duplicate: 0,
  created_at: '2026-01-05T12:00:00Z',
};

describe('ImportacoesPage', () => {
  beforeEach(() => {
    for (const mock of Object.values(apiMocks)) {
      if (typeof mock === 'function') mock.mockReset();
    }
    apiMocks.role = 'sdr';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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

  it('descarta a importação ainda em revisão', async () => {
    apiMocks.list.mockResolvedValue({ items: [{ ...batch, status: 'reviewing' }] });
    apiMocks.get.mockResolvedValue({ ...batch, status: 'reviewing', rows: [] });
    apiMocks.discard.mockResolvedValue({ id: 'lote-1', status: 'discarded' });

    renderPage();
    fireEvent.click(await screen.findByText('clientes.csv'));
    fireEvent.click(await screen.findByRole('button', { name: /Descartar importação/ }));

    await waitFor(() => expect(apiMocks.discard).toHaveBeenCalledWith('lote-1'));
    expect(await screen.findByText(/Importação descartada/)).toBeVisible();
  });

  it('exclui um lead de importação finalizada', async () => {
    apiMocks.list.mockResolvedValue({ items: [{ ...batch, status: 'confirmed' }] });
    apiMocks.get.mockResolvedValue({
      ...batch,
      status: 'confirmed',
      rows: [
        {
          id: 'linha-1',
          line_no: 2,
          status: 'ok',
          errors: null,
          payload: { nome: 'Importado A' },
          normalized: null,
          duplicate_of_lead_id: null,
          lead_id: 'lead-1',
          lead_state: 'active',
        },
        {
          id: 'linha-2',
          line_no: 3,
          status: 'ok',
          errors: null,
          payload: { nome: 'Importado B' },
          normalized: null,
          duplicate_of_lead_id: null,
          lead_id: 'lead-2',
          lead_state: 'deletion_pending',
        },
      ],
    });
    apiMocks.requestDeletion.mockResolvedValue({ id: 'pedido-1', status: 'pending' });

    renderPage();
    fireEvent.click(await screen.findByText('clientes.csv'));

    expect(await screen.findByText('Exclusão em avaliação')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Descartar importação/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Excluir/ }));

    await waitFor(() => expect(apiMocks.requestDeletion).toHaveBeenCalledWith('lead-1'));
    expect(screen.queryByText('Exclusões de leads para avaliar')).not.toBeInTheDocument();
  });

  it('permite ao administrador restaurar um lead excluído', async () => {
    apiMocks.role = 'admin';
    apiMocks.list.mockResolvedValue({ items: [] });
    apiMocks.deletionRequests.mockResolvedValue({
      items: [
        {
          id: 'pedido-1',
          lead_id: 'lead-1',
          lead_name: 'Importado A',
          phones: ['+5551999990000'],
          import_batch_id: 'lote-1',
          requested_by_name: 'SDR Teste',
          reason: null,
          status: 'pending',
          created_at: '2026-10-16T12:00:00Z',
        },
      ],
    });
    apiMocks.reviewDeletion.mockResolvedValue({ id: 'pedido-1', status: 'rejected' });

    renderPage();

    expect(await screen.findByText('Importado A')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar lead' }));
    await waitFor(() =>
      expect(apiMocks.reviewDeletion).toHaveBeenCalledWith('pedido-1', 'reject'),
    );
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
