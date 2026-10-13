import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePage } from './ProfilePage';

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'vendedor@example.com',
      name: 'Vendedor',
      role: 'vendedor',
      organization_id: 'org-1',
      products: [],
      grants: [],
    },
    refresh: mocks.refresh,
  }),
}));

vi.mock('@/lib/api', () => ({
  profile: {
    changePassword: mocks.changePassword,
    update: mocks.update,
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    mocks.changePassword.mockReset();
    mocks.update.mockReset();
    mocks.refresh.mockReset();
  });

  it('valida a confirmação e altera a senha sem expor os valores', async () => {
    mocks.changePassword.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Senha atual'), {
      target: { value: 'senha-segura' },
    });
    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'diferente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));
    expect(screen.getByText('A confirmação não corresponde à nova senha.')).toBeVisible();
    expect(mocks.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() =>
      expect(mocks.changePassword).toHaveBeenCalledWith(
        'senha-segura',
        'nova-senha-segura',
      ),
    );
    expect(
      await screen.findByText('Senha alterada. As outras sessões foram encerradas.'),
    ).toBeVisible();
  });

  it('atualiza o nome e recarrega o usuário autenticado', async () => {
    mocks.update.mockResolvedValue(undefined);
    mocks.refresh.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Novo Nome' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('Novo Nome'));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible();
  });
});
