import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { useAuth } from '@/app/AuthProvider';
import { ApiRequestError } from '@/lib/http';

const schema = z.object({
  email: z.string().min(1, 'Informe o login').email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
});

type FormValues = z.infer<typeof schema>;

const FIELD_CLASS =
  'h-12 w-full rounded-xl border border-[#1B3348] bg-[#0B1D2E] px-4 text-sm text-text-primary ' +
  'transition placeholder:text-[#5C7693] hover:border-[#27496B] focus:border-brand-cyan ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-cyan/30 disabled:opacity-60';

function messageForError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.status === 401) return 'E-mail ou senha incorretos. Verifique e tente novamente.';
    if (err.status === 429) {
      return 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.';
    }
    if (err.status === 403) return 'Acesso bloqueado. Procure a administração.';
  }
  return 'Não foi possível entrar agora. Tente novamente em instantes.';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revise os campos e tente novamente.');
      return;
    }
    try {
      const user = await login(parsed.data.email, parsed.data.password);
      const target =
        user.role === 'admin'
          ? '/admin'
          : user.role === 'sdr'
            ? '/sdr'
            : user.role === 'sinistros'
              ? '/area-sinistros'
              : '/';
      navigate(target, { replace: true });
    } catch (err) {
      setError(messageForError(err));
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
      <div className="w-full max-w-[380px] rounded-[20px] border border-white/[0.08] bg-[#071521] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="mb-7 flex justify-center">
          <img
            src="/logo-lynk.svg"
            alt="Lynk"
            className="h-[100px] w-full max-w-[240px] object-contain"
          />
        </div>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting}>
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="email">
              Login
            </label>
            <input
              id="email"
              type="email"
              className={FIELD_CLASS}
              placeholder="Digite o login"
              autoComplete="username"
              disabled={isSubmitting}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-erro' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-erro" className="mt-1.5 text-xs text-state-danger">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-text-primary"
              htmlFor="password"
            >
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${FIELD_CLASS} pr-12`}
                placeholder="Digite a senha"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'senha-erro' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-text-secondary transition hover:text-brand-cyan"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="senha-erro" className="mt-1.5 text-xs text-state-danger">
                {errors.password.message}
              </p>
            )}
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-state-danger/30 bg-state-danger/10 px-4 py-3 text-sm text-state-danger"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-brand-cyan text-sm font-bold tracking-wide text-[#041320] transition hover:bg-[#2BD6FF] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'ACESSANDO…' : 'ACESSAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
