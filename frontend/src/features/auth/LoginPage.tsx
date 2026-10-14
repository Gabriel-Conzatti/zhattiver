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
    <div
      className="grid min-h-screen place-items-center px-4 py-8"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 50%, rgba(0, 121, 255, 0.3), transparent 45%), linear-gradient(115deg, #062956 0%, #010b1a 52%, #053a4c 100%)',
      }}
    >
      <div className="w-full max-w-[315px] rounded-[2.25rem] bg-black px-7 py-7 shadow-2xl">
        <div className="mb-5 flex justify-center">
          <img
            src="/logo-funil.svg"
            alt="Funil Sustentare"
            className="h-[105px] w-[220px] object-contain"
          />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-semibold text-white" htmlFor="email">
              Login
            </label>
            <input
              id="email"
              type="email"
              className="h-8 w-full rounded-full border-0 bg-[#303030] px-4 text-sm text-white placeholder:text-[#8b8b8b] focus:border-0 focus:ring-2 focus:ring-brand-cyan"
              placeholder="Digite o login"
              autoComplete="username"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-state-danger">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-white" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="h-8 w-full rounded-full border-0 bg-[#303030] px-4 text-sm text-white placeholder:text-[#8b8b8b] focus:border-0 focus:ring-2 focus:ring-brand-cyan"
              placeholder="Digite a senha"
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
          <button
            type="submit"
            className="mt-7 h-8 w-full rounded-full bg-brand-cyan px-4 font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'ACESSANDO…' : 'ACESSAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
