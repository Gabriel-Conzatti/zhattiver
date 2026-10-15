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

function renderTopBar(addAction?: () => void) {
  return render(
    <MemoryRouter>
      <TopBar addAction={addAction}>
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

  it('não renderiza busca ou ação sem funcionamento', () => {
    renderTopBar();

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova venda' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Página inicial' })).toHaveAttribute('href', '/sdr');
    expect(screen.getByRole('img', { name: 'Lynk' })).toBeVisible();
    expect(screen.queryByText('Lynk')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute(
      'href',
      '/sdr/perfil',
    );
  });

  it('executa a ação contextual e o logout', () => {
    const addAction = vi.fn();
    renderTopBar(addAction);

    fireEvent.click(screen.getByRole('button', { name: 'Nova venda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(addAction).toHaveBeenCalledOnce();
    expect(mocks.logout).toHaveBeenCalledOnce();
  });
});
