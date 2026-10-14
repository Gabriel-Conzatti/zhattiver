import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VendedorDashboard } from './VendedorDashboard';

const apiMocks = vi.hoisted(() => ({
  goals: vi.fn(),
  schedules: vi.fn(),
  followups: vi.fn(),
  production: vi.fn(),
  bonus: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  opportunities: {
    myGoals: apiMocks.goals,
    myFollowups: apiMocks.followups,
  },
  schedules: { list: apiMocks.schedules },
  bonusApi: {
    myProduction: apiMocks.production,
    myBonus: apiMocks.bonus,
  },
}));

describe('VendedorDashboard', () => {
  beforeEach(() => {
    for (const mock of Object.values(apiMocks)) mock.mockReset();

    apiMocks.goals.mockResolvedValue({
      prospecting: { done: 2, target: 5 },
      schedules: { done: 1, target: 3 },
      followups: { done: 4, target: 4 },
      closes_at_hour: 19,
    });
    apiMocks.schedules.mockResolvedValue({
      today: '2026-10-14',
      items: [{
        id: 'schedule-1',
        lead_id: 'lead-1',
        lead_name: 'Cliente da agenda',
        lead_phone: '(51) 99999-0000',
        product_id: 'product-1',
        owner_user_id: 'user-1',
        coverage_end_date: '2026-11-30',
        date_confirmed: true,
        state: 'scheduled',
        origin_id: null,
        notes: null,
        previous_schedule_id: null,
        view: {
          business_days_remaining: 6,
          in_window: true,
          can_contact: true,
          past_contact_limit: false,
          label: 'Na janela',
          window_opens_on: '2026-11-20',
          contact_limit_on: '2026-11-26',
        },
      }],
    });
    apiMocks.followups.mockResolvedValue({
      pending: [{
        opportunity_id: 'opportunity-1',
        lead_name: 'Cliente do follow-up',
        last_relevant_at: '2026-10-13T15:00:00Z',
      }],
      next_actions: [],
    });
    apiMocks.production.mockResolvedValue({
      count: 2,
      goal: { target_count: 6 },
    });
    apiMocks.bonus.mockResolvedValue({ available: false, amount: null });
  });

  it('renderiza agenda, metas e follow-ups retornados pelas APIs', async () => {
    renderDashboard();

    expect(await screen.findByText('Cliente da agenda')).toBeVisible();
    expect(screen.getByText('30/11/2026')).toBeVisible();
    expect(screen.getByText('2/5')).toBeVisible();
    expect(screen.getByText('1/3')).toBeVisible();
    expect(screen.getByText('4/4')).toBeVisible();
    expect(screen.getByText('Cliente do follow-up')).toBeVisible();
  });

  it('expõe estado de erro no painel afetado', async () => {
    apiMocks.schedules.mockRejectedValue(new Error('indisponível'));

    renderDashboard();

    expect(await screen.findByText('Não foi possível carregar os agendamentos.')).toBeVisible();
    expect(screen.queryByText('Cliente da agenda')).not.toBeInTheDocument();
  });
});

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VendedorDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
