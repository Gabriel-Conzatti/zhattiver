import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/app/AuthProvider';
import { ApiRequestError } from '@/lib/http';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      const user = await login(parsed.data.email, parsed.data.password);
      const target = user.role === 'admin' ? '/admin' : user.role === 'sdr' ? '/sdr' : '/';
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        setError('Credenciais inválidas');
      } else {
        setError('Não foi possível entrar. Tente novamente em instantes.');
      }
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md card-strong p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-black font-bold">
            L
          </div>
          <div>
            <h1 className="text-xl font-semibold">Lynk</h1>
            <p className="text-sm text-text-secondary">Gestão de prospecção e novos negócios</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="username"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-state-danger">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-state-danger">{errors.password.message}</p>
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
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="mt-4 text-xs text-text-muted">
          Uso interno. Todas as ações são auditadas. Se você não possui acesso, contate a
          administração.
        </p>
      </div>
    </div>
  );
}
