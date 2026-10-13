import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { passwordRecovery } from '@/lib/api';
import { ApiRequestError } from '@/lib/http';

const schema = z
  .object({
    password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres'),
    confirmation: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((values) => values.password === values.confirmation, {
    message: 'A confirmação não corresponde à nova senha',
    path: ['confirmation'],
  });

type FormValues = z.infer<typeof schema>;

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : 'O link de redefinição está incompleto.',
  );
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'password' || field === 'confirmation') {
          setFieldError(field, { message: issue.message });
        }
      }
      return;
    }
    if (!token) {
      setError('O link de redefinição está incompleto.');
      return;
    }
    try {
      await passwordRecovery.reset(token, parsed.data.password);
      setCompleted(true);
    } catch (err) {
      if (
        err instanceof ApiRequestError
        && err.code === 'invalid_password_reset_token'
      ) {
        setError('Este link é inválido, expirou ou já foi utilizado.');
      } else if (
        err instanceof ApiRequestError
        && err.code === 'password_unchanged'
      ) {
        setError('A nova senha deve ser diferente da senha atual.');
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente em instantes.');
      }
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md card-strong p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Criar nova senha</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Defina uma senha exclusiva com pelo menos 10 caracteres.
          </p>
        </div>
        {completed ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-2 text-sm text-state-success"
            >
              Senha redefinida. Entre novamente em todos os seus dispositivos.
            </div>
            <Link className="btn-primary inline-flex w-full justify-center" to="/login">
              Entrar
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="label" htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                type="password"
                className="input"
                autoComplete="new-password"
                disabled={!token}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-state-danger">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="password-confirmation">
                Confirmar nova senha
              </label>
              <input
                id="password-confirmation"
                type="password"
                className="input"
                autoComplete="new-password"
                disabled={!token}
                {...register('confirmation')}
              />
              {errors.confirmation && (
                <p className="mt-1 text-xs text-state-danger">
                  {errors.confirmation.message}
                </p>
              )}
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-state-danger/30 bg-state-danger/10 px-3 py-2 text-sm text-state-danger"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isSubmitting || !token}
            >
              {isSubmitting ? 'Salvando…' : 'Redefinir senha'}
            </button>
            <Link
              className="block text-center text-sm text-brand-cyan hover:underline"
              to="/recuperar-senha"
            >
              Solicitar novo link
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
