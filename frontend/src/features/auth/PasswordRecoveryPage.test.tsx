import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { PasswordResetPage } from './PasswordResetPage';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  passwordRecovery: {
    request: mocks.request,
    reset: mocks.reset,
  },
}));

describe('recuperação de senha', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.reset.mockReset();
  });

  it('exibe a resposta genérica após solicitar o link', async () => {
    mocks.request.mockResolvedValue({
      message: 'Se existir uma conta ativa para este e-mail, enviaremos as instruções.',
    });
    render(
      <MemoryRouter>
        <PasswordRecoveryPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'pessoa@example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar link de recuperação' }),
    );

    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith('pessoa@example.com'),
    );
    expect(
      await screen.findByText(/Se existir uma conta ativa/),
    ).toBeVisible();
  });

  it('valida a confirmação e conclui a redefinição', async () => {
    mocks.reset.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={['/redefinir-senha?token=token-seguro']}>
        <PasswordResetPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'senha-diferente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(
      await screen.findByText('A confirmação não corresponde à nova senha'),
    ).toBeVisible();
    expect(mocks.reset).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), {
      target: { value: 'nova-senha-segura' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() =>
      expect(mocks.reset).toHaveBeenCalledWith(
        'token-seguro',
        'nova-senha-segura',
      ),
    );
    expect(
      await screen.findByText(/Senha redefinida/),
    ).toBeVisible();
  });
});
