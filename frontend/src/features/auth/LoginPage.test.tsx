import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ login: mocks.login }),
}));

describe('LoginPage', () => {
  it('exibe o login único sem recuperação ou seleção de perfil', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByAltText('Funil Sustentare')).toBeVisible();
    expect(screen.getByPlaceholderText('Digite o login')).toBeVisible();
    expect(screen.getByPlaceholderText('Digite a senha')).toBeVisible();
    expect(screen.getByRole('button', { name: 'ACESSAR' })).toBeVisible();
    expect(screen.queryByText('Esqueci minha senha')).not.toBeInTheDocument();
    expect(screen.queryByText('Vendedor')).not.toBeInTheDocument();
    expect(screen.queryByText('SDR')).not.toBeInTheDocument();
  });

  it('redireciona conforme o papel retornado pela autenticação', async () => {
    mocks.login.mockResolvedValue({ role: 'admin' });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Login'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'senha' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ACESSAR' }));

    expect(await screen.findByRole('button', { name: 'ACESSAR' })).toBeVisible();
    expect(mocks.login).toHaveBeenCalledWith('admin@example.com', 'senha');
  });
});
