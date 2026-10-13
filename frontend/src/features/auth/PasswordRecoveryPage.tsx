import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { passwordRecovery } from '@/lib/api';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

type FormValues = z.infer<typeof schema>;

export function PasswordRecoveryPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Preenchimento inválido');
      return;
    }
    try {
      const response = await passwordRecovery.request(parsed.data.email);
      setMessage(response.message);
    } catch {
      setError('Não foi possível solicitar a recuperação. Tente novamente em instantes.');
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md card-strong p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Recuperar senha</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Informe seu email para receber um link seguro de redefinição.
          </p>
        </div>
        {message ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-lg border border-state-success/30 bg-state-success/10 px-3 py-2 text-sm text-state-success"
            >
              {message}
            </div>
            <Link className="btn-secondary inline-flex w-full justify-center" to="/login">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="label" htmlFor="recovery-email">Email</label>
              <input
                id="recovery-email"
                type="email"
                className="input"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-state-danger">
                  {errors.email.message}
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
            <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
            <Link
              className="block text-center text-sm text-brand-cyan hover:underline"
              to="/login"
            >
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
