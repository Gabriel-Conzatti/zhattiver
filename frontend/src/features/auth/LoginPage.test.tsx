import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/http';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock('@/app/AuthProvider', () => ({
  useAuth: () => ({ login: mocks.login }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

function preencherCredenciais() {
  fireEvent.change(screen.getByLabelText('Login'), {
    target: { value: 'admin@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'senha' },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    mocks.login.mockReset();
  });

  it('exibe o login único sem recuperação ou seleção de perfil', () => {
    renderLogin();

    expect(screen.getByAltText('Lynk')).toBeVisible();
    expect(screen.getByPlaceholderText('Digite o login')).toBeVisible();
    expect(screen.getByPlaceholderText('Digite a senha')).toBeVisible();
    expect(screen.getByRole('button', { name: 'ACESSAR' })).toBeVisible();
    expect(screen.queryByText('Esqueci minha senha')).not.toBeInTheDocument();
    expect(screen.queryByText('Vendedor')).not.toBeInTheDocument();
    expect(screen.queryByText('SDR')).not.toBeInTheDocument();
  });

  it('redireciona conforme o papel retornado pela autenticação', async () => {
    mocks.login.mockResolvedValue({ role: 'admin' });
    renderLogin();

    preencherCredenciais();
    fireEvent.click(screen.getByRole('button', { name: 'ACESSAR' }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith('admin@example.com', 'senha'),
    );
  });

  it('alterna a visibilidade da senha', () => {
    renderLogin();

    const senha = screen.getByLabelText('Senha');
    expect(senha).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(senha).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(senha).toHaveAttribute('type', 'password');
  });

  it('envia o formulário ao pressionar Enter', async () => {
    mocks.login.mockResolvedValue({ role: 'vendedor' });
    const { container } = renderLogin();

    preencherCredenciais();
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith('admin@example.com', 'senha'),
    );
  });

  it('mostra o estado de carregamento durante a autenticação', async () => {
    let liberar: (value: { role: string }) => void = () => {};
    mocks.login.mockReturnValue(
      new Promise<{ role: string }>((resolve) => {
        liberar = resolve;
      }),
    );
    renderLogin();

    preencherCredenciais();
    fireEvent.click(screen.getByRole('button', { name: 'ACESSAR' }));

    const carregando = await screen.findByRole('button', { name: /ACESSANDO/ });
    expect(carregando).toBeDisabled();

    liberar({ role: 'vendedor' });
    await waitFor(() => expect(mocks.login).toHaveBeenCalled());
  });

  it('traduz credenciais inválidas em mensagem clara', async () => {
    mocks.login.mockRejectedValue(
      new ApiRequestError(401, { code: 'unauthorized', message: 'unauthorized' }),
    );
    renderLogin();

    preencherCredenciais();
    fireEvent.click(screen.getByRole('button', { name: 'ACESSAR' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha incorretos. Verifique e tente novamente.',
    );
  });

  it('avisa quando o acesso é bloqueado por excesso de tentativas', async () => {
    mocks.login.mockRejectedValue(
      new ApiRequestError(429, { code: 'rate_limited', message: 'rate limited' }),
    );
    renderLogin();

    preencherCredenciais();
    fireEvent.click(screen.getByRole('button', { name: 'ACESSAR' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
    );
  });
});
