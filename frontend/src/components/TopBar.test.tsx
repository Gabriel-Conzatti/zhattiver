import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TopBar } from './TopBar';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  role: 'sdr',
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'pessoa@example.com',
      name: 'Pessoa',
      role: mocks.role,
      organization_id: 'org-1',
      products: [],
      grants: [],
    },
    logout: mocks.logout,
  }),
}));

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <button type="button">Notificações</button>,
}));

function renderTopBar(newActions?: Array<{ label: string; onClick: () => void }>) {
  return render(
    <MemoryRouter>
      <TopBar newActions={newActions}>
        <span>Navegação</span>
      </TopBar>
    </MemoryRouter>,
  );
}

describe('TopBar', () => {
  beforeEach(() => {
    mocks.logout.mockReset();
    mocks.role = 'sdr';
  });

  it('não renderiza busca nem ação quando não configurada', () => {
    renderTopBar();

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova venda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Novo/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Página inicial' })).toHaveAttribute('href', '/sdr');
    expect(screen.getByRole('img', { name: 'Lynk' })).toBeVisible();
    expect(screen.queryByText('Lynk')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute(
      'href',
      '/sdr/perfil',
    );
  });

  it('abre o menu Novo e executa a opção escolhida', () => {
    const onLead = vi.fn();
    const onSchedule = vi.fn();
    renderTopBar([
      { label: 'Novo lead de prospecção', onClick: onLead },
      { label: 'Novo agendamento', onClick: onSchedule },
    ]);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Novo/ }));
    expect(screen.getByRole('menuitem', { name: 'Novo lead de prospecção' })).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Novo agendamento' }));

    expect(onSchedule).toHaveBeenCalledOnce();
    expect(onLead).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('executa o logout', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(mocks.logout).toHaveBeenCalledOnce();
  });
});
