import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SinistrosPage } from './SinistrosPage';

const useAuth = vi.fn();
const { createWorkshop } = vi.hoisted(() => ({
  createWorkshop: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/lib/api', () => ({
  claims: {
    statuses: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'status-1',
          name: 'Em acompanhamento',
          slug: 'em_acompanhamento',
          sort_order: 0,
          is_terminal: false,
        },
      ],
    }),
    catalogs: vi.fn().mockResolvedValue({
      branches: [
        { id: 'branch-auto', name: 'Auto' },
        { id: 'branch-re', name: 'RE' },
        { id: 'branch-rco', name: 'RCO ONIBUS' },
      ],
      insurers: [
        { id: 'insurer-allianz', name: 'Allianz' },
        { id: 'insurer-suhai', name: 'Suhai' },
      ],
      workshops: [],
    }),
    assignees: vi.fn().mockResolvedValue({
      users: [{ id: 'user-1', name: 'Usuário de teste' }],
      teams: [{ id: 'team-1', name: 'Equipe de sinistros' }],
    }),
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      per_page: 20,
      total: 0,
    }),
    get: vi.fn(),
    create: vi.fn(),
    changeStatus: vi.fn(),
    assign: vi.fn(),
    addEvent: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    archive: vi.fn(),
    createWorkshop,
    updateWorkshop: vi.fn(),
    archiveWorkshop: vi.fn(),
  },
}));

function renderPage(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SinistrosPage readOnly={readOnly} />
    </QueryClientProvider>,
  );
}

describe('SinistrosPage', () => {
  beforeEach(() => {
    createWorkshop.mockReset();
    createWorkshop.mockResolvedValue({
      id: 'workshop-1',
      name: 'Oficina Teste',
      phone: '(11) 3333-4444',
      address: 'Rua Teste, 100',
      responsible_name: 'Responsável Teste',
      insurer_ids: ['insurer-allianz'],
    });
    useAuth.mockReturnValue({
      user: {
        id: 'user-1',
        role: 'admin',
        grants: [],
      },
    });
  });

  it('exibe os filtros e o estado vazio', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Sinistros' })).toBeVisible();
    expect(screen.getByLabelText('Buscar sinistros')).toBeVisible();
    expect(screen.getByLabelText('Filtrar por status')).toBeVisible();
    expect(await screen.findByText('Nenhum sinistro encontrado para os filtros atuais.')).toBeVisible();
  });

  it('oculta ações de escrita no modo de consulta', async () => {
    renderPage(true);

    expect(screen.queryByRole('button', { name: /Novo sinistro/i })).not.toBeInTheDocument();
    expect(await screen.findByText('Nenhum sinistro encontrado para os filtros atuais.')).toBeVisible();
  });

  it('exibe o cadastro com responsável e equipe para o administrador', async () => {
    renderPage();

    const newClaimButton = await screen.findByRole('button', { name: /Novo sinistro/i });
    await waitFor(() => expect(newClaimButton).not.toBeDisabled());
    fireEvent.click(newClaimButton);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Novo sinistro' })).toBeVisible(),
    );
    expect(screen.getByLabelText('Responsável')).toBeVisible();
    expect(screen.getByLabelText('Equipe')).toBeVisible();
    expect(screen.getByLabelText('Ramo')).toHaveTextContent('RCO ONIBUS');
    expect(screen.getByLabelText('Seguradora')).toHaveTextContent('Suhai');
  });

  it('exibe cadastro de oficina com seguradoras referenciadas', async () => {
    renderPage();

    const workshopsButton = await screen.findByRole('button', { name: /Oficinas/i });
    await waitFor(() => expect(workshopsButton).not.toBeDisabled());
    fireEvent.click(workshopsButton);

    expect(
      await screen.findByRole('heading', { name: 'Oficinas referenciadas' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Nome da oficina')).toBeVisible();
    expect(screen.getByLabelText('Responsável')).toBeVisible();
    expect(screen.getByLabelText('Telefone')).toBeVisible();
    expect(screen.getByLabelText('Endereço')).toBeVisible();
    expect(screen.getByText('Allianz')).toBeVisible();
    expect(screen.getByText('Suhai')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Nome da oficina'), {
      target: { value: 'Oficina Teste' },
    });
    fireEvent.change(screen.getByLabelText('Responsável'), {
      target: { value: 'Responsável Teste' },
    });
    fireEvent.change(screen.getByLabelText('Telefone'), {
      target: { value: '(11) 3333-4444' },
    });
    fireEvent.change(screen.getByLabelText('Endereço'), {
      target: { value: 'Rua Teste, 100' },
    });
    fireEvent.click(screen.getByLabelText('Allianz'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar oficina' }));

    await waitFor(() =>
      expect(createWorkshop.mock.calls[0]?.[0]).toEqual({
          name: 'Oficina Teste',
          phone: '(11) 3333-4444',
          address: 'Rua Teste, 100',
          responsible_name: 'Responsável Teste',
          insurer_ids: ['insurer-allianz'],
        }),
    );
  });
});
