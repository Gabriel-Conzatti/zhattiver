import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OficinasPage } from './OficinasPage';
import { SeguradorasPage } from './SeguradorasPage';
import { SinistrosDashboard } from './SinistrosDashboard';
import { SinistrosListPage } from './SinistrosListPage';
import { SinistrosModule } from './SinistrosModule';

const useAuth = vi.fn();
const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  createWorkshop: vi.fn(),
  dashboard: vi.fn(),
  saveInsurerProfile: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/lib/api', () => ({
  claims: {
    statuses: vi.fn().mockResolvedValue({
      items: [
        { id: 'status-1', name: 'Em acompanhamento', slug: 'em_acompanhamento', sort_order: 0, is_terminal: false },
        { id: 'status-2', name: 'Concluído', slug: 'concluido', sort_order: 1, is_terminal: true },
      ],
    }),
    catalogs: vi.fn().mockResolvedValue({
      branches: [
        { id: 'branch-auto', name: 'Auto', item_type: 'vehicle' },
        { id: 'branch-re', name: 'RE', item_type: 'property' },
      ],
      insurers: [
        { id: 'insurer-allianz', name: 'Allianz' },
        { id: 'insurer-yelum', name: 'Yelum Affinity' },
      ],
      workshops: [
        {
          id: 'workshop-1',
          name: 'Oficina Centro',
          phone: null,
          address: 'Rua A, 1',
          city: 'Porto Alegre',
          responsible_name: 'Ana',
          insurer_ids: ['insurer-allianz'],
        },
        {
          id: 'workshop-2',
          name: 'Oficina Serra',
          phone: null,
          address: 'Rua B, 2',
          city: 'Caxias do Sul',
          responsible_name: 'Bruno',
          insurer_ids: ['insurer-yelum'],
        },
      ],
    }),
    assignees: vi.fn().mockResolvedValue({ users: [{ id: 'user-1', name: 'Usuária de sinistros' }] }),
    list: api.list,
    create: api.create,
    createWorkshop: api.createWorkshop,
    dashboard: api.dashboard,
    insurerProfiles: vi.fn().mockResolvedValue({
      items: [
        {
          insurer_id: 'insurer-allianz',
          name: 'Allianz',
          contacts: 'Central: 0800 000 0000',
          rental_car_contact: null,
          notes: 'Franquia no portal',
          updated_at: null,
        },
      ],
    }),
    saveInsurerProfile: api.saveInsurerProfile,
    get: vi.fn(),
    updateWorkshop: vi.fn(),
    archiveWorkshop: vi.fn(),
  },
}));

function renderInModule(page: ReactElement, readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Routes>
          <Route element={<SinistrosModule basePath="/sinistros" readOnly={readOnly} />}>
            <Route path="/" element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const claimRow = {
  id: 'claim-1',
  status_id: 'status-1',
  branch_id: 'branch-auto',
  insurer_id: 'insurer-allianz',
  workshop_id: null,
  status: 'em_acompanhamento',
  status_name: 'Em acompanhamento',
  is_closed: false,
  insured_name: 'Maria Segurada',
  next_follow_up_on: '2026-10-20',
  responsible_user_id: 'user-1',
  lead_id: null,
  opportunity_id: null,
  sale_id: null,
  claim_number: 'SIN-1',
  branch: 'Auto',
  insurer: 'Allianz',
  service_type: 'segurado_terceiro',
  has_third_party: true,
  workshop: null,
  vehicle_plate: 'ABC1D23',
  vehicle_model: 'Onix',
  vehicle_year: 2022,
  property_address: null,
  coverage: null,
  opened_on: '2026-10-16',
  concluded_on: null,
  closed_on: null,
  indemnified_on: null,
  indemnified_amount: null,
  notes: null,
  created_at: '2026-10-16T12:00:00Z',
  updated_at: '2026-10-16T12:00:00Z',
};

describe('Sinistros', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    api.list.mockResolvedValue({ items: [], page: 1, per_page: 20, total: 0 });
    useAuth.mockReturnValue({ user: { id: 'user-1', role: 'admin', grants: [] } });
  });

  it('exibe a navegação do módulo', () => {
    renderInModule(<SinistrosListPage state="open" />);

    const nav = screen.getByRole('navigation', { name: 'Navegação de sinistros' });
    for (const label of ['Dashboard', 'Abertos', 'Fechados', 'Oficinas', 'Infos']) {
      expect(within(nav).getByRole('link', { name: label })).toBeVisible();
    }
  });

  it('lista sinistros abertos de forma resumida', async () => {
    api.list.mockResolvedValue({ items: [claimRow], page: 1, per_page: 20, total: 1 });
    renderInModule(<SinistrosListPage state="open" />);

    expect(await screen.findByText('Maria Segurada')).toBeVisible();
    expect(screen.getByText('Segurado e Terceiro')).toBeVisible();
    expect(screen.getByText('20/10/2026')).toBeVisible();
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ state: 'open' }));
    const statusFilter = screen.getByLabelText('Filtrar por status');
    await waitFor(() => expect(statusFilter).toHaveTextContent('Em acompanhamento'));
    expect(statusFilter).not.toHaveTextContent('Concluído');
  });

  it('oculta ações de escrita no modo de consulta', async () => {
    renderInModule(<SinistrosListPage state="open" />, true);

    expect(await screen.findByText('Nenhum sinistro encontrado para os filtros atuais.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Novo sinistro/i })).not.toBeInTheDocument();
  });

  it('abre o sinistro somente com os campos de abertura', async () => {
    api.create.mockResolvedValue({ ...claimRow, parties: [], events: [], tasks: [] });
    renderInModule(<SinistrosListPage state="open" />);

    const newClaimButton = await screen.findByRole('button', { name: /Novo sinistro/i });
    await waitFor(() => expect(newClaimButton).not.toBeDisabled());
    fireEvent.click(newClaimButton);

    expect(await screen.findByRole('heading', { name: 'Novo sinistro' })).toBeVisible();
    expect(screen.queryByLabelText('Equipe')).not.toBeInTheDocument();
    expect(screen.queryByText('Previsão')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Seguradora')).toHaveTextContent('Yelum Affinity');
    expect(screen.getByLabelText('Tipo de atendimento')).toHaveTextContent('Apenas Terceiro');

    fireEvent.change(screen.getByLabelText('Ramo'), { target: { value: 'branch-re' } });
    expect(screen.getByLabelText('Endereço do imóvel')).toBeVisible();
    expect(screen.getByLabelText('Cobertura acionada')).toHaveTextContent('Vendaval');
    fireEvent.change(screen.getByLabelText('Ramo'), { target: { value: 'branch-auto' } });
    expect(screen.queryByLabelText('Endereço do imóvel')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nome do segurado'), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText('CPF/CNPJ'), { target: { value: '123.456.789-09' } });
    fireEvent.change(screen.getByLabelText('Telefone do segurado'), {
      target: { value: '(51) 99999-0000' },
    });
    fireEvent.change(screen.getByLabelText('Placa'), { target: { value: 'ABC1D23' } });
    fireEvent.change(screen.getByLabelText('Modelo'), { target: { value: 'Onix' } });
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2022' } });
    expect(screen.getByLabelText('Oficina (opcional)')).toHaveTextContent('Oficina Centro');
    expect(screen.getByLabelText('Oficina (opcional)')).not.toHaveTextContent('Oficina Serra');
    fireEvent.change(screen.getByLabelText('Tipo de atendimento'), {
      target: { value: 'segurado_terceiro' },
    });
    fireEvent.change(screen.getByLabelText('Nome do terceiro'), { target: { value: 'João' } });
    await waitFor(() => expect(screen.getByLabelText('Responsável')).toHaveValue('user-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar sinistro' }));

    await waitFor(() => expect(api.create).toHaveBeenCalledOnce());
    expect(api.create.mock.calls[0][0]).toMatchObject({
      branch_id: 'branch-auto',
      insurer_id: 'insurer-allianz',
      service_type: 'segurado_terceiro',
      responsible_user_id: 'user-1',
      vehicle_plate: 'ABC1D23',
      vehicle_model: 'Onix',
      vehicle_year: 2022,
      parties: [
        { role: 'segurado', name: 'Maria', document: '123.456.789-09', phone: '(51) 99999-0000' },
        { role: 'terceiro', name: 'João' },
      ],
    });
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('team_id');
    expect(api.create.mock.calls[0][0]).not.toHaveProperty('expected_on');
  });

  it('cadastra nova oficina durante a abertura do sinistro', async () => {
    api.createWorkshop.mockResolvedValue({
      id: 'workshop-3',
      name: 'Oficina Nova',
      phone: null,
      address: 'Rua C, 3',
      city: null,
      responsible_name: 'Carla',
      insurer_ids: ['insurer-allianz'],
    });
    renderInModule(<SinistrosListPage state="open" />);

    const newClaimButton = await screen.findByRole('button', { name: /Novo sinistro/i });
    await waitFor(() => expect(newClaimButton).not.toBeDisabled());
    fireEvent.click(newClaimButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar nova oficina' }));

    const dialog = await screen.findByRole('dialog', { name: 'Nova oficina' });
    fireEvent.change(within(dialog).getByLabelText('Nome da oficina'), {
      target: { value: 'Oficina Nova' },
    });
    fireEvent.change(within(dialog).getByLabelText('Responsável'), { target: { value: 'Carla' } });
    fireEvent.change(within(dialog).getByLabelText('Endereço'), { target: { value: 'Rua C, 3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar oficina' }));

    await waitFor(() =>
      expect(api.createWorkshop.mock.calls[0]?.[0]).toEqual({
        name: 'Oficina Nova',
        phone: null,
        address: 'Rua C, 3',
        city: null,
        responsible_name: 'Carla',
        insurer_ids: ['insurer-allianz'],
      }),
    );
  });

  it('mostra o dashboard com abertos e acompanhamentos do dia', async () => {
    api.dashboard.mockResolvedValue({
      today: '2026-10-16',
      open_count: 7,
      today_count: 2,
      items: [
        {
          task_id: 'task-1',
          claim_id: 'claim-1',
          title: 'Cobrar vistoria',
          due_on: '2026-10-15',
          priority: 'normal',
          overdue: true,
          insured_name: 'Maria Segurada',
          insurer: 'Allianz',
          claim_number: null,
          status_name: 'Em acompanhamento',
        },
      ],
    });
    renderInModule(<SinistrosDashboard />);

    expect(await screen.findByText('7')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Cobrar vistoria')).toBeVisible();
    expect(screen.getByText('Atrasado')).toBeVisible();
  });

  it('filtra oficinas por cidade e seguradora referenciada', async () => {
    renderInModule(<OficinasPage />);

    expect(await screen.findByText('Oficina Centro')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Buscar oficinas'), { target: { value: 'caxias' } });
    expect(screen.queryByText('Oficina Centro')).not.toBeInTheDocument();
    expect(screen.getByText('Oficina Serra')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Buscar oficinas'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filtrar por seguradora referenciada'), {
      target: { value: 'insurer-allianz' },
    });
    expect(screen.getByText('Oficina Centro')).toBeVisible();
    expect(screen.queryByText('Oficina Serra')).not.toBeInTheDocument();
  });

  it('exibe e edita as informações da seguradora', async () => {
    api.saveInsurerProfile.mockResolvedValue({});
    renderInModule(<SeguradorasPage />);

    expect(await screen.findByText('Central: 0800 000 0000')).toBeVisible();
    expect(screen.getByText('Franquia no portal')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Editar informações' }));
    fireEvent.change(screen.getByLabelText('Contato para carro reserva'), {
      target: { value: '0800 111 1111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.saveInsurerProfile).toHaveBeenCalledWith('insurer-allianz', {
        contacts: 'Central: 0800 000 0000',
        rental_car_contact: '0800 111 1111',
        notes: 'Franquia no portal',
      }),
    );
  });

  it('não permite editar seguradora no modo de consulta', async () => {
    renderInModule(<SeguradorasPage />, true);

    expect(await screen.findByText('Central: 0800 000 0000')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Editar informações' })).not.toBeInTheDocument();
  });
});
