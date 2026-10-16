import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/http';
import { SdrAgendamentosPage } from './SdrAgendamentosPage';
import { SdrProspeccaoPage } from './SdrProspeccaoPage';

const api = vi.hoisted(() => ({
  createSchedule: vi.fn(),
  requestDeletion: vi.fn(),
  archive: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'sdr-1', role: 'sdr', grants: [] } }),
}));

vi.mock('@/lib/api', () => ({
  catalog: {
    products: vi.fn().mockResolvedValue({
      items: [{ id: 'product-1', name: 'Auto', slug: 'auto', is_active: true }],
    }),
    origins: vi.fn().mockResolvedValue({ items: [] }),
    clientTypes: vi.fn().mockResolvedValue({ items: [] }),
  },
  leads: {
    list: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'lead-1',
          name: 'Lead Liberado',
          kind: 'pf',
          city: null,
          state: null,
          phones: ['+5551999990001'],
          archived: false,
          released: true,
        },
      ],
      page: 1,
      per_page: 50,
      total: 1,
    }),
    create: vi.fn(),
    release: vi.fn(),
    archive: api.archive,
    requestDeletion: api.requestDeletion,
  },
  schedules: {
    list: vi.fn().mockResolvedValue({ items: [], today: '2026-10-16' }),
    create: api.createSchedule,
  },
}));

function renderPage(page: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Fluxos do SDR', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('cadastra agendamento do zero e avisa quando o telefone já existe', async () => {
    api.createSchedule.mockRejectedValue(
      new ApiRequestError(409, {
        code: 'duplicate_lead',
        message: 'Já existe lead com esse telefone',
        details: { lead_id: 'lead-1', lead_name: 'Lead Liberado' },
      }),
    );
    renderPage(<SdrAgendamentosPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Cliente' } });
    fireEvent.change(screen.getByLabelText('Telefone'), { target: { value: '(51) 99999-0001' } });
    fireEvent.change(screen.getByLabelText('CEP (opcional)'), { target: { value: '90010-000' } });
    await screen.findByRole('option', { name: 'Auto' });
    fireEvent.change(screen.getByLabelText('Produto'), { target: { value: 'product-1' } });
    fireEvent.change(screen.getByLabelText('Vigência final'), { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar agendamento' }));

    await waitFor(() =>
      expect(api.createSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          new_lead: {
            name: 'Cliente',
            phone: '(51) 99999-0001',
            postal_code: '90010-000',
            city: null,
            state: null,
          },
          product_id: 'product-1',
        }),
      ),
    );
    expect(await screen.findByText(/Este telefone já está na base/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este lead' }));
    expect(screen.getByLabelText('Lead')).toHaveValue('lead-1');
  });

  it('mostra leads disponibilizados e envia exclusões para avaliação', async () => {
    api.requestDeletion.mockResolvedValue({ id: 'pedido-1', status: 'pending' });
    renderPage(<SdrProspeccaoPage />);

    expect(await screen.findByText('Disponibilizado')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lead' }));

    await waitFor(() => expect(api.requestDeletion).toHaveBeenCalledWith('lead-1'));
    expect(api.archive).not.toHaveBeenCalled();
    expect(await screen.findByText(/enviado para avaliação do administrador/)).toBeVisible();
  });
});
